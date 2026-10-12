import { expect, test } from "@playwright/test";

const projectId = 987659;
const suggestion = "O estudo aborda estratégias de inclusão digital para pessoas idosas. Confira os critérios antes de decidir.";
const project = { id: projectId, title: "Revisão de inclusão digital", objetivo: "Avaliar estratégias de participação digital.", status: "em-progresso", role: "owner", capabilities: ["read_project", "edit_project"], prismaStats: { identified: 2, screening: 2, eligible: 2, included: 0 }, researchQuestions: ["Quais estratégias ampliam a participação digital de pessoas idosas?", "Quais barreiras foram identificadas?"], eligibilityChecklist: [], dataExtractionSchema: [], qualityAssessmentSchema: [] };

test("decision panels remain consistent and functional on narrow and wide screens", async ({ page }, testInfo) => {
  await page.route("**/api/auth/profile", (route) => route.fulfill({ json: { success: true, user: { id: 1, name: "Ana", email: "ana@example.com" } } }));
  await page.route("**/api/inbox**", (route) => route.fulfill({ json: { notifications: [], invitations: [], unreadNotificationCount: 0, pendingInvitationCount: 0 } }));
  await page.route(`**/api/projetos/${projectId}`, (route) => route.fulfill({ json: project }));
  await page.route(`**/api/projetos/${projectId}/members`, (route) => route.fulfill({ json: { members: [], invitations: [] } }));
  await page.route(`**/api/projetos/${projectId}/selection-report`, (route) => route.fulfill({ json: {} }));
  const article = { id: 31, title: "Estratégias de inclusão digital para pessoas idosas", abstract: "O estudo avalia intervenções de capacitação digital.", authors: "Ana Silva", year: 2026, sourceName: "Scopus", reviewOutcome: "active", hasPdf: false, aiEvaluation: suggestion };
  await page.route(`**/api/projetos/${projectId}/artigos**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("selection-summary")) return route.fulfill({ json: { totalRecords: 2, screening: { total: 2 }, eligibility: { total: 2 }, identification: { total: 0 }, included: 0 } });
    if (url.pathname.endsWith("/artigos")) return route.fulfill({ json: { articles: [{ ...article, currentPhase: url.searchParams.get("phase") }, { ...article, id: 32, title: "Segundo estudo da revisão", currentPhase: url.searchParams.get("phase") }], total: 2, page: 1, pageSize: 20 } });
    if (url.pathname.endsWith("/31") || url.pathname.endsWith("/32")) return route.fulfill({ json: { ...article, id: Number(url.pathname.split("/").at(-1)), currentPhase: "eligibility" } });
    return route.fulfill({ json: [] });
  });

  for (const [flow, title] of [["screening", "Decisão de triagem"], ["eligibility", "Decisão de elegibilidade"]]) {
    await page.goto(`/projetos/${projectId}?tab=artigos&flow=${flow}`);
    await expect(page.getByRole("tablist", { name: "Áreas do workspace", includeHidden: true })).toBeAttached();
    const regionTab = page.getByRole("tab", { name: "Decisão", exact: true });
    if (await regionTab.isVisible()) await regionTab.click();
    const panel = page.getByRole("complementary", { name: title });
    await expect(panel.getByRole("heading", { name: title })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Incluir", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "Salvar e próximo" })).toBeEnabled();
    await panel.screenshot({ path: `test-results/evidence/decision-${flow}-${testInfo.project.name}.png` });
    if (flow === "screening") {
      await expect(panel.getByRole("button", { name: "Copiar para justificativa" })).toBeHidden();
      await panel.getByText("Sugestão da IA", { exact: true }).click();
      await panel.getByRole("button", { name: "Copiar para justificativa" }).click();
      await expect(panel.getByRole("textbox", { name: "Justificativa" })).toHaveValue(suggestion);
      await expect(panel.getByRole("button", { name: "Incluir", exact: true })).toHaveAttribute("aria-pressed", "true");
    } else {
      await panel.getByText("Consultar perguntas", { exact: true }).click();
      await expect(panel.getByText(project.researchQuestions[0], { exact: true })).toBeVisible();
      await panel.getByRole("button", { name: "RQ 1", exact: true }).click();
      await expect(panel.getByRole("button", { name: "RQ 1", exact: true })).toHaveAttribute("aria-pressed", "true");
      await panel.getByRole("button", { name: "Texto completo indisponível" }).click();
      await panel.getByRole("button", { name: "Salvar e próximo" }).click();
      await expect(panel.getByRole("alert")).toHaveText("O motivo da indisponibilidade é obrigatório.");
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await panel.screenshot({ path: `test-results/evidence/decision-${flow}-expanded-${testInfo.project.name}.png` });
  }
});
