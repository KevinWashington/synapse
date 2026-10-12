import { expect, test } from "@playwright/test";

const id = 987657;
const project = {
  id, title: "Inclusão digital no envelhecimento: revisão sistemática",
  objetivo: "Identificar estratégias e barreiras para a participação digital de pessoas idosas.",
  status: "em-progresso", role: "owner", capabilities: ["read_project", "edit_project"],
  framework: "PICOC", researchQuestions: ["Quais estratégias de inclusão digital são utilizadas?"],
  prismaStats: { identified: 1093, screening: 130, eligible: 10, included: 3 },
  dataExtractionSchema: [], qualityAssessmentSchema: [],
};
const overview = {
  prismaStats: project.prismaStats, reviewerAgreement: { rate: 80, agreed: 8, reviewed: 10 },
  sources: Array.from({ length: 12 }, (_, index) => ({ sourceCategory: "database", sourceName: index === 0 ? "Web of Science" : `Base bibliográfica ${index + 1}`, total: index === 0 ? 222 : 79 })),
  evolution: Array.from({ length: 10 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, identification: 900 + index * 20, screening: 100 + index * 3, eligibility: 10, included: 3 })),
  recentActivities: Array.from({ length: 25 }, (_, index) => ({ id: index + 1, articleId: index + 1, label: "Decisão de elegibilidade registrada", description: `Estudo ${index + 1}: estratégias para ampliar o acesso digital`, type: "eligibility", timestamp: "2026-10-10T12:00:00Z" })),
  studyTypes: [{ label: "Artigo de periódico", total: 2, percentage: 66.7 }, { label: "Revisão", total: 1, percentage: 33.3 }],
  planningSummary: { framework: "PICOC", searchStringCount: 3, inclusionCriteriaCount: 4, exclusionCriteriaCount: 3, extractionFieldCount: 8 },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/profile", (route) => route.fulfill({ json: { success: true, user: { id: 1, name: "Ana", email: "ana@example.com" } } }));
  await page.route("**/api/inbox**", (route) => route.fulfill({ json: { notifications: [], invitations: [], unreadNotificationCount: 0, pendingInvitationCount: 0 } }));
  await page.route(`**/api/projetos/${id}`, (route) => route.fulfill({ json: project }));
  await page.route(`**/api/projetos/${id}/members`, (route) => route.fulfill({ json: { members: [], invitations: [] } }));
  await page.route(`**/api/projetos/${id}/overview`, (route) => route.fulfill({ json: overview }));
  await page.route(`**/api/projetos/${id}/synthesis/**`, (route) => route.fulfill({ json: route.request().url().endsWith("/overview")
    ? { includedCount: 3, extractedCount: 2, coveredRQCount: 2, researchQuestionCount: 5, qualityAssessedCount: 2 }
    : { items: [], total: 0, page: 1, pageSize: 20 } }));
  await page.route(`**/api/projetos/${id}/artigos/selection-summary`, (route) => route.fulfill({ json: { totalRecords: 1093, included: 3 } }));
  await page.route(`**/api/projetos/${id}/selection-report`, (route) => route.fulfill({ json: {
    counts: { identified: 1093, duplicatesRemoved: 130, screeningPool: 963, excludedScreening: 833, fullTextUnavailable: 2, excludedEligibility: 7, included: 3 },
    bySource: overview.sources, exclusionReasons: { eligibility: [{ reason: "População fora do escopo", count: 4 }, { reason: "Intervenção não elegível", count: 3 }] },
  } }));
});

test("overview and synthesis share a text-only summary header", async ({ page }, testInfo) => {
  for (const [tab, title] of [["overview", "Visão geral da revisão"], ["sintese", "Síntese da revisão"]]) {
    await page.goto(`/projetos/${id}?tab=${tab}`);
    const header = page.locator("header").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(header.locator("dl dt")).toHaveCount(4);
    await expect(header.locator("dl svg")).toHaveCount(0);
    await expect(header.locator("dl dd").first()).toContainText(tab === "overview" ? "1.093" : "3");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await header.screenshot({ path: `test-results/evidence/shared-header-${tab}-${testInfo.project.name}.png` });
  }
});

test("overview and flow follow the workspace composition without page overflow", async ({ page }, testInfo) => {
  const phase = process.env.AUDIT_PHASE || "after";
  await page.goto(`/projetos/${id}?tab=overview`);
  await expect(page.getByRole("heading", { name: "Visão geral da revisão" })).toBeVisible();
  await page.screenshot({ path: `test-results/evidence/${phase}-overview-${testInfo.project.name}.png`, fullPage: true });
  if (phase !== "before") {
    await expect(page.getByRole("heading", { name: "Visão geral da revisão" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByRole("button", { name: "Fontes e atividades", exact: true }).click();
    await expect(page.getByText("Base bibliográfica 12", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/evidence/${phase}-activities-${testInfo.project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Protocolo e estudos", exact: true }).click();
    await expect(page.getByRole("region", { name: "Resumo do planejamento" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Fluxo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fluxo PRISMA", exact: true })).toBeVisible();
  await expect(page.getByText("Carregando fluxo...")).toHaveCount(0);
  await page.screenshot({ path: `test-results/evidence/${phase}-flow-${testInfo.project.name}.png`, fullPage: true });
  if (phase !== "before") {
    await expect(page.getByRole("region", { name: "Diagrama PRISMA" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByRole("button", { name: "Resumo e fontes", exact: true }).click();
    await expect(page.getByRole("region", { name: "Resumo do fluxo" })).toBeVisible();
    await expect(page.getByText("Base bibliográfica 12", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/evidence/${phase}-flow-summary-${testInfo.project.name}.png`, fullPage: true });
  }
});
