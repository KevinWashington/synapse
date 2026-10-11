import { expect, test } from "@playwright/test";

test("team table fills its card and keeps removal visibly destructive and confirmed", async ({ page }, testInfo) => {
  const projectId = 987655;
  await page.route("**/api/auth/profile", (route) => route.fulfill({ json: { success: true, user: { id: 1, name: "Ana", email: "ana@example.com" } } }));
  await page.route(`**/api/projetos/${projectId}`, (route) => route.fulfill({ json: {
    id: projectId, title: "Revisão em equipe", status: "em-progresso", role: "owner",
    capabilities: ["read_project", "manage_members", "transfer_ownership", "manage_distribution", "resolve_conflicts"],
  } }));
  await page.route(`**/api/projetos/${projectId}/members`, (route) => route.fulfill({ json: {
    members: [
      { id: null, userId: 1, name: "Ana", email: "ana@example.com", role: "owner", status: "active", participatesInReview: true },
      { id: 2, userId: 2, name: "Bruno", email: "bruno@example.com", role: "reviewer", status: "active", participatesInReview: true },
    ], invitations: [],
  } }));
  await page.route(`**/api/projetos/${projectId}/assignments`, (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/projetos/${projectId}/conflicts`, (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/projetos/${projectId}/assignments/preview`, (route) => route.fulfill({ json: { phase: "screening", articleCount: 12, reviewerCount: 2, loads: { 1: 12, 2: 12 }, assignments: [{ articleId: 10 }] } }));
  await page.goto(`/projetos/${projectId}?tab=equipe`);
  const table = page.getByRole("table", { name: "Participantes do projeto" });
  const remove = page.getByRole("button", { name: "Remover Bruno" });
  await expect(table).toBeVisible();
  const background = await remove.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  await expect(remove).toHaveClass(/bg-destructive/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  if (testInfo.project.name === "desktop-chromium") {
    const card = await table.locator("xpath=ancestor::*[@data-slot='card']").boundingBox();
    const bounds = await table.boundingBox();
    expect(Math.abs(bounds.x - card.x)).toBeLessThan(3);
    expect(Math.abs(bounds.width - card.width)).toBeLessThan(3);
    const actions = await page.getByRole("button", { name: "Transferir propriedade para Bruno" }).boundingBox();
    expect(card.x + card.width - actions.x - actions.width).toBeLessThan(30);
  }
  await page.screenshot({ path: `test-results/evidence/team-layout-${testInfo.project.name}.png`, fullPage: true });
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Remover pessoa?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Seções da equipe" });
  for (const button of await navigation.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  }
  await navigation.getByRole("button", { name: /Convites/ }).click();
  await expect(table).not.toBeVisible();
  await expect(page.getByText("Nenhum convite pendente.")).toBeVisible();
  await navigation.getByRole("button", { name: /Distribuição/ }).click();
  await page.getByRole("button", { name: "Pré-visualizar distribuição" }).click();
  await expect(page.getByText("12 artigos · 2 revisores")).toBeVisible();
  await navigation.getByRole("button", { name: /Discordâncias/ }).click();
  await expect(page.getByText("Nenhuma discordância neste projeto.")).toBeVisible();
  await navigation.getByRole("button", { name: /Distribuição/ }).click();
  await expect(page.getByText("12 artigos · 2 revisores")).toBeVisible();
  await page.screenshot({ path: `test-results/evidence/team-distribution-${testInfo.project.name}.png`, fullPage: true });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
