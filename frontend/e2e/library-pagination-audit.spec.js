import { expect, test } from "@playwright/test";
import path from "node:path";

const apiBaseUrl = "http://localhost:5000";
const csrfToken = "playwright-csrf";
const evidenceDir = path.resolve("../docs/audits/playwright-library-pagination-2026-10-06");

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

test.describe("article library pagination", () => {
  test("keeps the library compact and navigates every result", async ({ context, page }, testInfo) => {
    test.setTimeout(120_000);
    await authenticate(context);

    const project = await post(page.request, "/api/projetos", {
      title: `Auditoria da biblioteca ${testInfo.project.name} ${Date.now()}`,
      objetivo: "Validar paginação e consistência visual da biblioteca.",
      status: "em-progresso",
      researchQuestions: ["A biblioteca permanece utilizável com muitos artigos?"],
      criteriosInclusao: ["Artigo de teste"],
      criteriosExclusao: ["Fora do escopo"],
    });

    const entries = Array.from({ length: 25 }, (_, index) => ({
      title: `Artigo de biblioteca ${String(index + 1).padStart(2, "0")}`,
      authors: `Autora ${index + 1}`,
      year: 2024,
      journal: "Journal da Biblioteca",
      doi: `10.7777/biblioteca-${testInfo.project.name}-${index + 1}`,
    }));

    try {
      await post(
        page.request,
        `/api/projetos/${project.id}/artigos/import-bibtex?evaluate_ai=false&generate_embeddings=false`,
        {
          sourceCategory: "database",
          sourceName: "Scopus",
          importBatchLabel: "playwright-library",
          entries,
        }
      );

      await page.goto("/artigos");
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: project.title }).click();

      await expect(page.getByText("25 registros encontrados", { exact: true })).toBeVisible();
      await expect(page.getByTestId("library-article-card")).toHaveCount(20);
      await expect(page.getByText("Mostrando 1–20 de 25 artigos", { exact: true })).toBeVisible();
      await expect(page.getByText("Página 1 de 2", { exact: true })).toBeVisible();
      const libraryListHeight = (await page.getByTestId("library-list-scroll").boundingBox()).height;
      expect(libraryListHeight).toBeLessThan(700);
      await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-01-library-page-1.png`), fullPage: true });

      await page.getByRole("button", { name: "Próxima página" }).click();
      await expect(page.getByTestId("library-article-card")).toHaveCount(5);
      await expect(page.getByText("Mostrando 21–25 de 25 artigos", { exact: true })).toBeVisible();
      await expect(page.getByText("Página 2 de 2", { exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-02-library-page-2.png`), fullPage: true });
    } finally {
      await page.request.delete(`${apiBaseUrl}/api/projetos/${project.id}`, {
        headers: { "X-CSRF-Token": csrfToken },
      });
    }
  });
});
