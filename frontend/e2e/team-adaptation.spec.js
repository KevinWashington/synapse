import { expect, test } from "@playwright/test";

test("adaptation is previewed before applying and remains usable with many vacancies", async ({ page }, testInfo) => {
  const id = 987659;
  let applied = false;
  let appliedBody;
  const preview = { phase: "screening", reviewerCount: 1, reviewsPerArticle: 1, articleCount: 118,
    cancelledCount: 118, assignedCount: 0, consolidatedCount: 4, loads: { 1: 114 }, fingerprint: "a".repeat(64) };
  await page.route("**/api/auth/profile", route => route.fulfill({ json: { success: true, user: { id: 1, name: "Ana", email: "ana@example.com" } } }));
  await page.route(`**/api/projetos/${id}`, route => route.fulfill({ json: { id, title: "Adaptação da equipe", status: "em-progresso", role: "owner", capabilities: ["read_project", "manage_members", "manage_distribution"] } }));
  await page.route(`**/api/projetos/${id}/members`, route => route.fulfill({ json: { members: [{ id: null, userId: 1, name: "Ana", role: "owner", status: "active", participatesInReview: true }], invitations: [] } }));
  await page.route(`**/api/projetos/${id}/assignments`, route => route.fulfill({ json: applied ? [] : [
    ...Array.from({ length: 118 }, (_, index) => ({ id: index + 1, articleId: index + 100, phase: "screening", reviewerUserId: 25, slot: 2, status: "needs_reassignment" })),
    { id: 999, articleId: 9999, phase: "eligibility", reviewerUserId: 25, slot: 2, status: "needs_reassignment" },
  ] }));
  await page.route(`**/api/projetos/${id}/assignments/adapt/preview`, route => route.fulfill({ json: preview }));
  await page.route(`**/api/projetos/${id}/assignments/adapt`, route => {
    applied = true;
    appliedBody = route.request().postDataJSON();
    return route.fulfill({ json: preview });
  });
  await page.goto(`/projetos/${id}?tab=equipe`);
  await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Distribuição/ }).click();
  await expect(page.getByText(/Atenção: 118 vaga/)).toBeVisible();
  await expect(page.getByText(/Artigo 9999/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Reatribuir artigo/ })).toHaveCount(20);
  await page.getByRole("button", { name: "Adaptar à equipe atual" }).click();
  await expect(page.getByText(/118 artigos serão adaptados/)).toBeVisible();
  expect(applied).toBe(false);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `../docs/audits/team-adaptation-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Confirmar adaptação" }).click();
  await expect(page.getByText("Distribuição adaptada à equipe atual.")).toBeVisible();
  expect(appliedBody).toEqual({ phase: "screening", fingerprint: "a".repeat(64) });
  await expect(page.getByRole("button", { name: /^Reatribuir artigo/ })).toHaveCount(0);
});
