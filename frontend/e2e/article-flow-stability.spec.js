import { expect, test } from "@playwright/test";
import path from "node:path";

const apiBaseUrl = "http://localhost:5000";
const csrfToken = "playwright-csrf";
const evidenceDir = path.resolve("../docs/audits/playwright-article-flow-stability-2026-10-07");

async function authenticate(context) {
  const token = process.env.E2E_SESSION_TOKEN;
  test.skip(!token, "E2E_SESSION_TOKEN is required for authenticated flows");
  await context.addCookies([
    { name: "synapse_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "synapse_session_csrf", value: csrfToken, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function post(request, endpoint, data) {
  const response = await request.post(`${apiBaseUrl}${endpoint}`, {
    data,
    headers: { "X-CSRF-Token": csrfToken },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function uploadPdf(request, projectId, articleId) {
  const response = await request.post(
    `${apiBaseUrl}/api/projetos/${projectId}/artigos/${articleId}/pdf`,
    {
      headers: { "X-CSRF-Token": csrfToken },
      multipart: {
        file: {
          name: "texto-completo-auditoria.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% Synapse workflow audit\n%%EOF"),
        },
      },
    }
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function capture(page, testInfo, number, name) {
  const file = path.join(evidenceDir, `${number}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(`${number}-${name}`, { path: file, contentType: "image/png" });
}

function articleRow(page, title) {
  return page.locator('[data-testid="stage-article-row"]').filter({ hasText: title });
}

async function openArticleFromRow(page, title) {
  const row = articleRow(page, title);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: new RegExp(title) }).first().click();
}

test.describe("stable article workflow", () => {
  test("keeps totals, decisions, extraction, navigation and account context coherent", async ({ context, page }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(testInfo.project.name !== "desktop-chromium", "The complete flow captures desktop and narrow states once.");
    await authenticate(context);

    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });

    const primaryTitle = "Fluxo estavel 01 - avaliacao principal";
    const secondaryTitle = "Fluxo estavel 02 - navegacao incluida";
    let project;

    try {
      project = await post(page.request, "/api/projetos", {
        title: `Auditoria descartavel do fluxo ${Date.now()}`,
        objetivo: "Validar o fluxo completo sem alterar projetos existentes.",
        status: "em-progresso",
        researchQuestions: ["O estudo responde a pergunta da revisao?"],
        criteriosInclusao: ["Estudo primario relacionado ao tema"],
        criteriosExclusao: ["Estudo fora do escopo"],
        eligibilityChecklist: ["O texto completo responde a pergunta da revisao?"],
        dataExtractionSchema: [{ key: "resultado", label: "Resultado principal", type: "text", options: [] }],
      });

      const uniqueEntries = Array.from({ length: 23 }, (_, index) => ({
        title: index === 0 ? primaryTitle : index === 1 ? secondaryTitle : `Fluxo estavel ${String(index + 1).padStart(2, "0")}`,
        authors: `Autora ${index + 1}`,
        year: 2026,
        journal: "Journal de Auditoria",
        doi: `10.7000/fluxo-estavel-${index + 1}`,
        abstract: `Resumo controlado do estudo ${index + 1}.`,
      }));
      const imported = await post(
        page.request,
        `/api/projetos/${project.id}/artigos/import-bibtex?evaluate_ai=false&generate_embeddings=false`,
        {
          sourceCategory: "database",
          sourceName: "Scopus",
          importBatchLabel: "playwright-stable-flow",
          entries: [
            ...uniqueEntries,
            {
              title: "Duplicata controlada A",
              authors: "Autora Duplicada",
              year: 2026,
              journal: "Journal de Auditoria",
              doi: "10.7000/duplicata-controlada",
            },
            {
              title: "Duplicata controlada B",
              authors: "Autora Duplicada",
              year: 2026,
              journal: "Journal de Auditoria",
              doi: "10.7000/duplicata-controlada",
            },
          ],
        }
      );
      const [primaryId, secondaryId] = imported.articleIds;

      await page.goto(`/projetos/${project.id}?tab=artigos&flow=identification`);
      await expect(page.getByText("Carregando artigos...")).not.toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("25 na fila", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("20 exibidos de 25", { exact: true })).toBeVisible();
      await expect(page.getByText("Página 1 de 2", { exact: true })).toBeVisible();
      await capture(page, testInfo, "01", "identification-paginated");

      await page.getByRole("button", { name: "Enviar todos os únicos para triagem" }).click();
      await expect(page.getByRole("dialog", { name: "Enviar todos os únicos?" })).toBeVisible();
      await page.getByRole("button", { name: "Confirmar envio" }).click();
      await expect(page.getByText("2 na fila", { exact: true })).toBeVisible({ timeout: 30_000 });

      await page.route(`**/api/projetos/${project.id}/artigos?*`, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const phase = new URL(route.request().url()).searchParams.get("phase");
        if (phase === "screening" && Array.isArray(body.articles)) {
          body.articles = body.articles.map((item) =>
            item.id === primaryId
              ? {
                  ...item,
                  aiEvaluation: "A justificativa sugerida pela IA deve ser revisada pelo pesquisador.",
                  aiSuggestedStatus: "incluido",
                }
              : item
          );
        }
        await route.fulfill({ response, json: body });
      });

      await page.getByRole("button", { name: /Triagem/ }).first().click();
      await expect(page.getByText("23 na fila", { exact: true })).toBeVisible();
      await expect(page.getByText("20 exibidos de 23", { exact: true })).toBeVisible();
      await expect(page.getByText("Página 1 de 2", { exact: true })).toBeVisible();
      await capture(page, testInfo, "02", "screening-full-total");

      await page.getByRole("button", { name: "Próxima página" }).click();
      await expect(page.getByText("Página 2 de 2", { exact: true })).toBeVisible();
      await openArticleFromRow(page, primaryTitle);
      await page.getByRole("button", { name: "Incluir", exact: true }).click();
      const screeningDialog = page.getByRole("dialog", { name: "Decisao de triagem" });
      await expect(screeningDialog).toBeVisible();
      await screeningDialog.getByRole("button", { name: "Usar justificativa da IA" }).click();
      const screeningReason = screeningDialog.getByRole("textbox", { name: "Justificativa" });
      await expect(screeningReason).toHaveValue(/justificativa sugerida/);
      await screeningReason.fill("Justificativa da IA copiada e revisada pelo pesquisador.");
      await screeningDialog.getByRole("button", { name: "Salvar decisao" }).click();
      await expect(screeningDialog).not.toBeVisible();

      await post(
        page.request,
        `/api/projetos/${project.id}/artigos/${secondaryId}/screening-decision`,
        { decision: "included", reasonText: "Preparado para navegacao entre incluidos." }
      );
      await uploadPdf(page.request, project.id, secondaryId);
      await post(
        page.request,
        `/api/projetos/${project.id}/artigos/${secondaryId}/eligibility-decision`,
        { decision: "included", reasonText: null, checklistAnswers: {}, answeringRQs: [1] }
      );

      await page.getByRole("button", { name: /Elegibilidade/ }).first().click();
      await expect(articleRow(page, primaryTitle)).toBeVisible();
      await openArticleFromRow(page, primaryTitle);
      await page.getByRole("button", { name: "Enviar PDF" }).click();
      await page.locator("#pdf-file").setInputFiles({
        name: "texto-completo-principal.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% Synapse primary audit\n%%EOF"),
      });
      await page.getByRole("dialog").getByRole("button", { name: "Enviar PDF" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();

      await openArticleFromRow(page, primaryTitle);
      await page.getByRole("button", { name: "Incluir", exact: true }).click();
      const eligibilityDialog = page.getByRole("dialog", { name: "Decisao de Elegibilidade" });
      await eligibilityDialog.getByRole("button", { name: "Sim" }).click();
      await eligibilityDialog.getByRole("button", { name: "RQ 1" }).click();
      await eligibilityDialog.getByRole("button", { name: "Salvar decisao" }).click();
      await expect(eligibilityDialog).not.toBeVisible();

      await page.getByRole("button", { name: /Inclusão/ }).first().click();
      await expect(page.getByText("2 na fila", { exact: true })).toBeVisible();
      await openArticleFromRow(page, primaryTitle);
      await page.getByRole("button", { name: "Abrir workspace de extração" }).click();
      await expect(page).toHaveURL(new RegExp(`/projetos/${project.id}/artigos/${primaryId}\\?flow=included&workspace=extracao`));
      await expect(page.getByRole("button", { name: "Abrir menu da conta" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Navegacao estrutural" })).toContainText("Extração de dados");

      const extractionField = page.getByPlaceholder("Digite resultado principal...");
      await extractionField.fill("Resultado mantido entre PDF e Notas");
      await page.getByRole("button", { name: "Notas", exact: true }).click();
      await page.getByPlaceholder("Digite suas notas aqui...").fill("Nota local da extração");
      await page.getByRole("button", { name: "PDF", exact: true }).click();
      await expect(extractionField).toHaveValue("Resultado mantido entre PDF e Notas");
      await capture(page, testInfo, "03", "extraction-desktop");

      await page.getByRole("button", { name: "Marcar como concluido" }).click();
      const completionDialog = page.getByRole("dialog", { name: "Concluir extração?" });
      await expect(completionDialog).toBeVisible();
      await completionDialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(completionDialog).not.toBeVisible();
      await expect(extractionField).toHaveValue("Resultado mantido entre PDF e Notas");
      await page.getByRole("button", { name: "Marcar como concluido" }).click();
      await completionDialog.getByRole("button", { name: "Confirmar conclusão" }).click();
      await expect(completionDialog).not.toBeVisible();

      const nextButton = page.locator("main").getByRole("button", { name: /Proximo/ });
      const previousButton = page.locator("main").getByRole("button", { name: /Anterior/ });
      const navigationButton = (await nextButton.isEnabled()) ? nextButton : previousButton;
      await navigationButton.click();
      await expect(page).toHaveURL(/flow=included&workspace=extracao/);
      await expect(page.getByText("Carregando artigo...")).not.toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Formulario de extracao", { exact: true })).toBeVisible();

      await page.setViewportSize({ width: 1024, height: 768 });
      await capture(page, testInfo, "04", "extraction-narrow");

      await page.goto(`/projetos/${project.id}`);
      const projectTabs = [
        ["Planejamento", "planejamento"],
        ["Artigos", "artigos"],
        ["Fluxo", "fluxo"],
        ["Síntese", "sintese"],
        ["Gráficos", "grafo"],
        ["Visão Geral", null],
      ];
      for (const [label, tab] of projectTabs) {
        await page.getByRole("button", { name: label, exact: true }).click();
        if (tab) {
          await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
        } else {
          await expect(page).not.toHaveURL(/tab=/);
        }
      }

      await page.getByRole("button", { name: "Planejamento", exact: true }).click();
      await page.getByRole("button", { name: "Artigos", exact: true }).click();
      await page.goBack();
      await expect(page).toHaveURL(/tab=planejamento/);
      await page.goForward();
      await expect(page).toHaveURL(/tab=artigos&flow=identification/);
      await expect(page.getByText("Carregando artigos...")).not.toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("2 na fila", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Abrir menu da conta" })).toBeVisible();
      await capture(page, testInfo, "05", "project-navigation-narrow");

      const unexpectedBrowserErrors = browserErrors.filter(
        (message) =>
          !message.includes("favicon") &&
          !message.includes("Failed to load PDF") &&
          !message.includes("Invalid PDF structure"),
      );
      expect(unexpectedBrowserErrors).toEqual([]);

      await testInfo.attach("browser-errors", {
        body: Buffer.from(browserErrors.join("\n") || "none"),
        contentType: "text/plain",
      });
    } finally {
      if (project?.id) {
        await page.request.delete(`${apiBaseUrl}/api/projetos/${project.id}`, {
          headers: { "X-CSRF-Token": csrfToken },
        });
      }
    }
  });
});
