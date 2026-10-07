import { expect, test } from "@playwright/test";
import path from "node:path";

const evidenceDir = path.resolve("../docs/audits/playwright-identification-scale-2026-10-06");
const apiBaseUrl = "http://localhost:5000";
const csrfToken = "playwright-csrf";

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

test.describe("identification at scale", () => {
  test("paginates the full count, holds duplicates, and promotes every unique record", async ({ context, page }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== "desktop-chromium", "This data-heavy audit runs once on desktop.");
    await authenticate(context);

    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });

    const objective = "Esta revisão sistemática possui uma descrição deliberadamente longa para validar que o cabeçalho mantenha a mesma altura e o mesmo conteúdo durante toda a navegação entre visão geral, planejamento e artigos.";
    const project = await post(page.request, "/api/projetos", {
      title: `Auditoria de identificação em escala ${Date.now()}`,
      objetivo: objective,
      status: "em-progresso",
      researchQuestions: ["O fluxo permanece funcional acima de cem registros?"],
      criteriosInclusao: ["Estudo relacionado ao tema"],
      criteriosExclusao: ["Estudo fora do escopo"],
    });

    const entries = Array.from({ length: 103 }, (_, index) => ({
      title: `Registro único de escala ${String(index + 1).padStart(3, "0")}`,
      authors: `Autor ${index + 1}`,
      year: 2024,
      journal: "Journal de Escala",
      doi: `10.5555/escala-${index + 1}`,
    }));
    entries.push(
      {
        title: "Duplicata de escala na fonte A",
        authors: "Autora Duplicada",
        year: 2024,
        journal: "Journal de Escala",
        doi: "10.5555/duplicata-controlada",
      },
      {
        title: "Duplicata de escala na fonte B",
        authors: "Autora Duplicada",
        year: 2024,
        journal: "Journal de Escala",
        doi: "10.5555/duplicata-controlada",
      }
    );

    try {
      await post(
        page.request,
        `/api/projetos/${project.id}/artigos/import-bibtex?evaluate_ai=false&generate_embeddings=false`,
        {
          sourceCategory: "database",
          sourceName: "Scopus",
          importBatchLabel: "playwright-scale",
          entries,
        }
      );

      await page.goto(`/projetos/${project.id}`);
      await expect(page.getByText(objective)).toBeVisible();
      const overviewObjectiveHeight = (await page.getByTestId("project-objective").boundingBox()).height;

      const supportingCards = await Promise.all([
        page.getByTestId("overview-data-sources").boundingBox(),
        page.getByTestId("overview-evolution").boundingBox(),
        page.getByTestId("overview-activities").boundingBox(),
      ]);
      const widths = supportingCards.map((box) => box.width);
      expect(Math.max(...widths) / Math.min(...widths)).toBeLessThan(1.15);
      await page.screenshot({ path: path.join(evidenceDir, "01-balanced-overview.png"), fullPage: true });

      await page.getByRole("button", { name: "Planejamento", exact: true }).click();
      await expect(page.getByText(objective)).toBeVisible();
      const planningObjectiveHeight = (await page.getByTestId("project-objective").boundingBox()).height;
      expect(planningObjectiveHeight).toBe(overviewObjectiveHeight);

      await page.getByRole("button", { name: "Artigos", exact: true }).click();
      await expect(page.getByRole("button", { name: "Enviar todos os únicos para triagem" })).toBeVisible();
      await expect(page.getByText("105 na fila", { exact: true })).toBeVisible();
      await expect(page.getByText("20 exibidos de 105", { exact: true })).toBeVisible();
      await expect(page.getByText("Página 1 de 6", { exact: true })).toBeVisible();
      const stageListHeight = (await page.getByTestId("stage-list-scroll").boundingBox()).height;
      expect(stageListHeight).toBeLessThan(700);
      await page.screenshot({ path: path.join(evidenceDir, "02-identification-page-1.png"), fullPage: true });

      await page.getByRole("button", { name: "Próxima página" }).click();
      await expect(page.getByText("20 exibidos de 105", { exact: true })).toBeVisible();
      await expect(page.getByText("Página 2 de 6", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Enviar todos os únicos para triagem" }).click();
      await expect(page.getByRole("heading", { name: "Revisar duplicatas" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("2 na fila", { exact: true })).toBeVisible();
      await expect(page.getByText("Possíveis duplicatas")).toBeVisible();
      await expect(page.getByText("2 (100%)", { exact: true })).toBeVisible();
      await expect(page.getByText("Únicos na fila")).toBeVisible();
      await expect(page.getByText("0 (0%)", { exact: true })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Manter Duplicata de escala na fonte A" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Manter Duplicata de escala na fonte B" })).toBeVisible();
      await page.screenshot({ path: path.join(evidenceDir, "03-duplicates-held-for-review.png"), fullPage: true });

      await page.getByRole("radio", { name: "Manter Duplicata de escala na fonte A" }).check();
      await page.getByRole("button", { name: "Confirmar revisão de duplicatas" }).click();
      await expect(page.getByRole("heading", { name: "Revisar duplicatas" })).not.toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("1 na fila", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Enviar todos os únicos para triagem" }).click();
      await expect(page.getByText("0 na fila", { exact: true })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: /Triagem/ }).first().click();
      await expect(page.getByText("104 na fila", { exact: true })).toBeVisible();
      await expect(page.getByText("20 exibidos de 104", { exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(evidenceDir, "04-screening-all-unique.png"), fullPage: true });

      expect(browserErrors.filter((message) => !message.includes("favicon"))).toEqual([]);
    } finally {
      await page.request.delete(`${apiBaseUrl}/api/projetos/${project.id}`, {
        headers: { "X-CSRF-Token": csrfToken },
      });
    }
  });
});
