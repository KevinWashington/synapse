import { expect, test } from "@playwright/test";

const title = "Estratégias de inclusão digital para a população idosa: uma revisão sistemática da literatura e suas intervenções";
const tasks = Array.from({ length: 9 }, (_, index) => ({ assignmentId: index + 1, articleId: 980001 + index, projectId: 980000, projectTitle: title, title: `${title} ${index + 1}`, year: 2026, journal: "Journal of Digital Inclusion", phase: "screening", assignedAt: "2026-10-11T12:00:00Z" }));
const stats = { totalProjects: 35, totalArticles: 1093, dailyReviews: [{ date: "2026-10-08", count: 12 }, { date: "2026-10-09", count: 20 }, { date: "2026-10-10", count: 8 }] };
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/profile", (route) => route.fulfill({ json: { success: true, user: { id: 1, name: "Ana", email: "ana@example.com" } } }));
  await page.route("**/api/inbox**", (route) => route.fulfill({ json: { notifications: [], invitations: [], unreadNotificationCount: 0, pendingInvitationCount: 0 } }));
  await page.route(/\/api\/projetos(?:\?.*)?$/, (route) => route.fulfill({ json: { projects: [], total: 0 } }));
  await page.route("**/api/home/summary", (route) => route.fulfill({ json: { screeningPending: 9, eligibilityPending: 1 } }));
  await page.route("**/api/home/tasks?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const page = Number(params.get("page"));
    const phase = params.get("phase");
    const items = phase === "eligibility" ? [{ ...tasks[0], phase }] : tasks.slice((page - 1) * 4, page * 4);
    return route.fulfill({ json: { items, total: phase === "eligibility" ? 1 : 9, page, pageSize: 4 } });
  });
  await page.route("**/api/home/activity?**", (route) => route.fulfill({ json: { items: [{ id: "screening:980001", articleId: 980001, projectId: 980000, projectTitle: title, title, type: "screening", phase: "eligibility", timestamp: "2026-10-11T12:00:00Z" }], total: 1, page: 1, pageSize: 4 } }));
  await page.route("**/api/stats", (route) => route.fulfill({ json: stats }));
});

test("personal home shows bounded work, activity and invitations", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Seu espaço de revisão" })).toBeVisible();
  const work = page.getByRole("region", { name: "Seu trabalho pendente" });
  const activity = page.getByRole("region", { name: "Atividade recente", exact: true });
  await expect(work.getByRole("link")).toHaveCount(4);
  await expect(activity.getByRole("link")).toHaveAttribute("href", /flow=eligibility/);
  await expect(page.getByRole("region", { name: "Continuar leitura", exact: true })).toContainText("neste dispositivo");
  await expect(page.getByRole("region", { name: "Projetos recentes" })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Artigos analisados por data" })).toContainText("20");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `test-results/evidence/personal-home-${info.project.name}.png`, fullPage: true, animations: "disabled" });
  if (info.project.name === "desktop-chromium") {
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: "test-results/evidence/personal-home-tablet.png", fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await work.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(work).toContainText("página 2 de 3");
  await work.getByRole("tab", { name: /Elegibilidade/ }).click();
  await expect(work.getByRole("link")).toHaveCount(1);
  await expect(work.getByRole("link")).toHaveAttribute("href", /flow=eligibility.*assignedToMe=1/);
  await page.getByRole("button", { name: "Ver convites" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("task failures are local and retryable", async ({ page }) => {
  let fail = true;
  await page.route("**/api/home/tasks?**", (route) => fail ? route.fulfill({ status: 503, json: { detail: "Offline" } }) : route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 4 } }));
  await page.goto("/");
  const work = page.getByRole("region", { name: "Seu trabalho pendente" });
  await expect(work.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Atividade recente", exact: true }).getByRole("link")).toBeVisible();
  fail = false;
  await work.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(work).toContainText("Nenhum artigo atribuído");
});

test("revoked resume access hides metadata and clears the reference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("synapse:last-reading:v1:1", JSON.stringify({ projectId: 980000, articleId: 980001, phase: "screening", workspace: "notas", savedAt: new Date().toISOString() })));
  await page.route("**/api/projetos/980000", (route) => route.fulfill({ status: 404, json: { detail: "Not found" } }));
  await page.route("**/api/projetos/980000/artigos/980001", (route) => route.fulfill({ status: 404, json: { detail: "Not found" } }));
  await page.route("**/api/home/reading?**", (route) => route.fulfill({ status: 404, json: { detail: "Not found" } }));
  await page.goto("/");
  const resume = page.getByRole("region", { name: "Continuar leitura", exact: true });
  await expect(resume).toContainText("neste dispositivo");
  await expect(resume.getByRole("link")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("synapse:last-reading:v1:1"))).toBeNull();
});
