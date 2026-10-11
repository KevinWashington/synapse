import { expect, test } from "@playwright/test";

test("analytics uses a connected workspace with scoped filters and accessible sections", async ({ page }, testInfo) => {
  const id = 987656;
  await page.route("**/api/auth/profile", (route) => route.fulfill({ json: { success: true, user: { id: 1, name: "Ana", email: "ana@example.com" } } }));
  await page.route(`**/api/projetos/${id}`, (route) => route.fulfill({ json: { id, title: "Análise da revisão", status: "em-progresso", capabilities: ["read_project"], researchQuestions: ["Quais barreiras foram observadas?"] } }));
  await page.route(`**/api/projetos/${id}/members`, (route) => route.fulfill({ json: { members: [], invitations: [] } }));
  await page.route(`**/api/projetos/${id}/overview`, (route) => route.fulfill({ json: {} }));
  await page.route(`**/api/projetos/${id}/artigos?*`, (route) => route.fulfill({ json: { articles: Array.from({ length: 24 }, (_, index) => ({
    id: index + 1, title: `Estudo ${index + 1}`, year: index < 12 ? 2024 : 2025, studyType: index < 12 ? "journal_article" : "review",
    sourceName: index < 12 ? "Web of Science" : "Scopus", currentPhase: index < 12 ? "screening" : "included", reviewOutcome: index < 12 ? "active" : "included", keywords: "Inclusão digital; Saúde", aiKeywords: [],
  })), total: 24, limit: 500 } }));
  await page.route(`**/api/projetos/${id}/synthesis/charts`, (route) => route.fulfill({ json: [{ key: "rq:1", rqNumber: 1, label: "Quais barreiras foram observadas?", type: "rq" }] }));
  await page.route(`**/api/projetos/${id}/synthesis/charts/rq%3A1*`, (route) => route.fulfill({ json: { field: { type: "text", label: "Barreiras" }, rows: { items: [{ articleId: 1, title: "Título longo de um estudo sobre inclusão digital e barreiras ao acesso à saúde", year: 2025, value: "Acesso limitado a equipamentos e conectividade." }] } } }));
  await page.route(`**/api/projetos/${id}/grafo*`, (route) => route.fulfill({ json: { nodes: [], links: [] } }));
  await page.goto(`/projetos/${id}?tab=grafo`);
  const navigation = page.getByRole("navigation", { name: "Seções de gráficos" });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publicações por ano" })).toBeVisible();
  await expect.poll(() => page.locator(".recharts-bar-rectangle path").first().evaluate((element) => element.getBBox().height)).toBeGreaterThan(150);
  await expect.poll(() => page.locator(".recharts-sector").first().evaluate((element) => element.getBBox().width)).toBeGreaterThan(159);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `test-results/evidence/analytics-panorama-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("combobox", { name: "Período" }).click();
  await page.getByRole("option", { name: "2025", exact: true }).click();
  await expect(page.getByText("Registros no recorte").locator("..")).toHaveText("Registros no recorte12");
  await navigation.getByRole("button", { name: "Perguntas de pesquisa" }).click();
  await expect(page.getByText("Acesso limitado a equipamentos e conectividade.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Período" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `test-results/evidence/analytics-rqs-${testInfo.project.name}.png`, fullPage: true });
  await navigation.getByRole("button", { name: "Relações entre artigos" }).click();
  await expect(page.getByText(/Adicione artigos ao projeto/)).toBeVisible();
  await navigation.getByRole("button", { name: "Panorama" }).click();
  await expect(page.getByRole("combobox", { name: "Período" })).toContainText("2025");
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByText("Registros no recorte").locator("..")).toHaveText("Registros no recorte24");
});
