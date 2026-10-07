import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const evidenceDir = path.resolve("../docs/audits/playwright-ui-consistency-2026-10-07");
const apiBaseUrl = "http://localhost:5000";
const csrfToken = "playwright-csrf";

fs.mkdirSync(evidenceDir, { recursive: true });

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

async function capture(page, testInfo, number, name) {
  await page.screenshot({
    path: path.join(evidenceDir, `${testInfo.project.name}-${number}-${name}.png`),
    fullPage: true,
  });
}

function articleRow(page, title) {
  return page.locator('[data-testid="stage-article-row"]').filter({ hasText: title });
}

async function openArticleFromRow(page, title) {
  await articleRow(page, title).getByRole("button", { name: new RegExp(title) }).first().click();
}

test.describe("review workflow audit", () => {
  test("moves records through identification, screening, eligibility and inclusion", async ({ context, page }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== "desktop-chromium", "The functional audit uses the desktop workbench.");
    await authenticate(context);

    const browserErrors = [];
    const observations = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });

    const project = await post(page.request, "/api/projetos", {
      title: `Auditoria do fluxo ${Date.now()}`,
      objetivo: "Validar o fluxo operacional completo da revisao sistematica.",
      status: "em-progresso",
      researchQuestions: ["A intervencao produz o resultado esperado?"],
      criteriosInclusao: ["Estudo primario relacionado ao tema"],
      criteriosExclusao: ["Nao responde a pergunta de pesquisa"],
      eligibilityChecklist: ["O texto completo responde a pergunta de pesquisa?"],
      dataExtractionSchema: [{ key: "resultado", label: "Resultado principal", type: "text", options: [] }],
    });

    const titles = [
      "Fluxo auditavel A - candidato a inclusao",
      "Fluxo auditavel B - candidato a exclusao",
      "Fluxo auditavel C - permanece na identificacao",
    ];

    try {
      for (const [index, title] of titles.entries()) {
        await post(page.request, `/api/projetos/${project.id}/artigos`, {
          title,
          authors: `Autor ${index + 1}`,
          year: 2024,
          journal: "Journal de Auditoria",
          sourceCategory: "database",
          sourceName: "Scopus",
          entryMethod: "manual",
          abstract: `Resumo controlado para validar a etapa ${index + 1}.`,
        });
      }

      await page.goto(`/projetos/${project.id}?tab=artigos&flow=identification`);
      await expect(page.getByRole("heading", { name: /Identifica/ })).toBeVisible();
      await expect(articleRow(page, titles[0])).toBeVisible();
      await capture(page, testInfo, "01", "identification-start");

      const promoteButton = page.getByRole("button", { name: /Enviar \d+ para triagem/ });
      await expect(promoteButton).toBeDisabled();
      observations.push("promotion-disabled-with-zero-selection=true");

      for (const title of titles.slice(0, 2)) {
        const row = articleRow(page, title);
        await row.locator('input[type="checkbox"]').check();
      }
      await expect(page.getByText("2 selecionados")).toBeVisible();
      await capture(page, testInfo, "02", "identification-selected");

      await promoteButton.click();
      await expect(page.getByRole("heading", { name: "Triagem" })).toBeVisible();
      await expect(articleRow(page, titles[0])).toBeVisible();
      await expect(articleRow(page, titles[1])).toBeVisible();
      await capture(page, testInfo, "03", "screening-after-promotion");

      await openArticleFromRow(page, titles[0]);
      await page.getByRole("button", { name: "Incluir", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, testInfo, "04", "screening-include-dialog");
      await page.getByRole("button", { name: "Salvar decisão" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();

      await openArticleFromRow(page, titles[1]);
      await page.getByRole("button", { name: "Excluir", exact: true }).click();
      await page.getByPlaceholder(/Obrigatório ao excluir/).fill("Não responde à pergunta de pesquisa.");
      await page.getByRole("button", { name: "Salvar decisão" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(articleRow(page, titles[1])).toHaveCount(0);
      await expect(page.getByText("Selecione um artigo", { exact: true })).toBeVisible();
      observations.push("excluded-record-leaves-active-queue=true");
      await capture(page, testInfo, "05", "screening-after-decisions");

      await page.getByRole("button", { name: /Elegibilidade/ }).first().click();
      await expect(page.getByRole("heading", { name: "Elegibilidade" })).toBeVisible();
      await expect(articleRow(page, titles[0])).toBeVisible();
      await page.getByRole("button", { name: "Pular por agora", exact: true }).click();
      await expect(page.getByText("Artigo mantido pendente. Próximo item aberto.")).toBeVisible();
      await capture(page, testInfo, "06", "eligibility-pending-action");

      await expect(page.getByRole("button", { name: "Incluir", exact: true })).toBeDisabled();
      await expect(page.getByText("Envie o PDF para liberar a decisão de inclusão.")).toBeVisible();
      await capture(page, testInfo, "07", "eligibility-inclusion-blocked-without-pdf");

      await page.getByRole("button", { name: "Enviar PDF" }).click();
      await page.locator('#pdf-file').setInputFiles({
        name: "texto-completo-auditoria.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% Synapse functional audit\n%%EOF"),
      });
      await page.getByRole("dialog").getByRole("button", { name: "Enviar PDF" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.getByText("PDF disponível")).toBeVisible();
      const detailAfterUpload = await page.locator("section").filter({ hasText: titles[0] }).last().innerText();
      observations.push(`detail-after-upload-shows-pdf=${detailAfterUpload.includes("PDF disponível")}`);
      observations.push(`detail-after-upload-still-pending=${detailAfterUpload.includes("Texto completo pendente")}`);
      await capture(page, testInfo, "08", "eligibility-after-upload");

      await openArticleFromRow(page, titles[0]);
      await page.getByRole("button", { name: "Incluir", exact: true }).click();
      await page.getByText("Sim", { exact: true }).click();
      await page.getByText("RQ 1", { exact: true }).click();
      await page.getByRole("button", { name: "Salvar decisão" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();

      await page.getByRole("button", { name: /Inclus/ }).first().click();
      await expect(page.getByRole("heading", { name: /Inclus/ })).toBeVisible();
      await expect(articleRow(page, titles[0])).toBeVisible();
      await capture(page, testInfo, "09", "included-final");

      const summary = await page.request.get(`${apiBaseUrl}/api/projetos/${project.id}/artigos/selection-summary`);
      const summaryData = await summary.json();
      observations.push(`summary=${JSON.stringify(summaryData)}`);
    } finally {
      try {
        const response = await page.request.delete(`${apiBaseUrl}/api/projetos/${project.id}`, {
          headers: { "X-CSRF-Token": csrfToken },
        });
        observations.push(`cleanup-status=${response.status()}`);
      } catch (cleanupError) {
        observations.push(`cleanup-error=${cleanupError.message}`);
      }
      await testInfo.attach("review-flow-observations", {
        body: Buffer.from(observations.join("\n")),
        contentType: "text/plain",
      });
      await testInfo.attach("browser-errors", {
        body: Buffer.from(browserErrors.join("\n") || "none"),
        contentType: "text/plain",
      });
    }
  });
});
