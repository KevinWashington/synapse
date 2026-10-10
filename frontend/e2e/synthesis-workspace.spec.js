import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const evidenceDir = path.resolve("../docs/audits/synthesis-workspace-2026-10-10");

test("synthesis workspace remains contained and traceable across its four modes", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const projectId = 987654;
  await page.route("**/api/auth/profile", (route) => route.fulfill({ json: { success: true, user: { id: 42, name: "E2E Reviewer", email: "e2e@example.com" } } }));
  await page.route(`**/api/projetos/${projectId}`, (route) => route.fulfill({ json: {
    id: projectId,
    title: "Synthesis workspace QA",
    objetivo: "Validate the evidence synthesis workspace.",
    status: "em-progresso",
    role: "owner",
    capabilities: ["read_project", "edit_project", "manage_distribution", "manage_members", "resolve_conflicts"],
    researchQuestions: ["Quais resultados foram observados nesta amostra de estudos?"],
    dataExtractionSchema: Array.from({ length: 40 }, (_, index) => ({ key: `field_${index + 1}`, label: `Campo de extração ${index + 1}`, type: "text", options: [] })),
    qualityAssessmentSchema: [{ key: "bias", label: "Risco de viés" }],
  } }));
  await page.route(`**/api/projetos/${projectId}/members`, (route) => route.fulfill({ json: { members: [], invitations: [] } }));
  let generationStatus = "queued";
  let draftVersion = 0;

  await page.route(`**/api/projetos/${projectId}/synthesis/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathName = url.pathname;
    let body = {};
    let status = 200;
    if (pathName.endsWith("/overview")) body = { includedCount: 1003, extractedCount: 846, coveredRQCount: 1, researchQuestionCount: 1, qualityAssessedCount: 700 };
    else if (pathName.endsWith("/rqs") && request.method() === "GET") body = { items: [{ rqNumber: 1, question: "Quais resultados foram observados nesta amostra de estudos?", evidenceCount: 1003, draftState: draftVersion ? "draft" : "not_started", duplicateQuestion: false }], page: 1, pageSize: 20, total: 1 };
    else if (pathName.endsWith("/rqs/1/evidence")) body = { items: Array.from({ length: 20 }, (_, index) => ({ articleId: index + 1, title: `Study ${index + 1} — digital health outcomes`, year: 2024, qualityRating: "high", evidenceExcerpt: "Observed changes in access and health outcomes." })), page: Number(url.searchParams.get("page") || 1), pageSize: 20, total: 1003 };
    else if (pathName.endsWith("/rqs/1") && request.method() === "GET") body = { rqNumber: 1, question: "Quais resultados foram observados nesta amostra de estudos?", questionFingerprint: "a".repeat(64), draft: draftVersion ? { content: { narrative: "The generated draft summarizes observed evidence.", keyFindings: [], divergences: [], limitations: [] }, version: draftVersion, sourceArticleIds: [1], evidenceFingerprint: "b".repeat(64) } : null, activeGeneration: generationStatus === "queued" ? { id: 9, status: generationStatus, rqNumber: 1, completedBatches: 0, totalBatches: 1 } : null, context: { evidenceCount: 1003, includedCount: 1003, coverage: 100, freshness: "current", quality: { total: 700 } } };
    else if (pathName.endsWith("/rqs/1/generations") && request.method() === "POST") { status = 202; body = { id: 9, rqNumber: 1, status: "queued", completedBatches: 0, totalBatches: 1 }; }
    else if (pathName.endsWith("/generations/9")) { generationStatus = "succeeded"; draftVersion = 1; body = { id: 9, rqNumber: 1, status: "succeeded", completedBatches: 1, totalBatches: 1 }; }
    else if (pathName.endsWith("/matrix")) body = { items: Array.from({ length: 20 }, (_, index) => ({ articleId: index + 1, title: `Study ${index + 1} — a long title contained in its table column`, year: 2024, sourceName: "Web of Science", qualityRating: "high", extractionValues: Object.fromEntries(Array.from({ length: 40 }, (_, fieldIndex) => [`field_${fieldIndex + 1}`, `value ${fieldIndex + 1}`])) })), page: 1, pageSize: 20, total: 1003 };
    else if (pathName.endsWith("/charts")) body = [{ key: "year", label: "Ano de publicação", type: "number", group: "general" }, { key: "field_1", label: "Campo de extração 1", type: "text", group: "Campos extraídos" }];
    else if (pathName.endsWith("/charts/year")) body = { key: "year", field: { key: "year", label: "Ano de publicação", type: "number" }, sampleSize: 1003, missingCount: 0, rows: [{ value: 2023, count: 400 }, { value: 2024, count: 603 }] };
    else if (pathName.endsWith("/quality/criteria")) body = [{ key: "overall", label: "Avaliação geral", kind: "overall", total: 1003, distribution: { high: 700, medium: 200, low: 50, unrated: 53 } }, { key: "bias", label: "Risco de viés", kind: "criterion", total: 1003, distribution: { yes: 700, partial: 200, no: 103 } }];
    else if (pathName.endsWith("/quality/studies")) body = { items: Array.from({ length: 20 }, (_, index) => ({ articleId: index + 1, title: `Study ${index + 1}`, year: 2024, qualityRating: "high", qualityScore: 90 })), page: 1, pageSize: 20, total: 1003 };
    else if (pathName.includes("/exports/")) return route.fulfill({ status: 200, contentType: "text/csv; charset=utf-8", body: "title,year\r\nStudy,2024\r\n" });
    else if (request.method() === "PATCH" && pathName.endsWith("/rqs/1")) { draftVersion += 1; body = { content: request.postDataJSON().content, version: draftVersion, questionFingerprint: "a".repeat(64) }; }
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });

  fs.mkdirSync(evidenceDir, { recursive: true });
    await page.goto(`/projetos/${projectId}?tab=sintese`);
    await expect(page.getByRole("heading", { name: "Síntese da revisão" })).toBeVisible();
    await expect(page.getByText("1003").first()).toBeVisible();
    for (const viewport of [{ width: 1440, height: 1024 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-${viewport.width}-rqs.png`), fullPage: true });
      await page.getByRole("button", { name: "Matriz de extração" }).click();
      await expect(page.getByText("Study 1 — a long title contained in its table column")).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-${viewport.width}-matrix.png`), fullPage: true });
      await page.getByRole("button", { name: "Visualizações" }).click();
      if (viewport.width < 1280) await page.getByRole("tab", { name: "Contexto" }).click();
      await expect(page.getByText("Como ler")).toBeVisible();
      await page.getByRole("button", { name: "Avaliação da qualidade" }).click();
      if (viewport.width < 1280) await page.getByRole("tab", { name: "Conteúdo" }).click();
      await expect(page.getByText("Estudos avaliados")).toBeVisible();
      await page.getByRole("button", { name: "Perguntas de pesquisa" }).click();
      if (viewport.width < 1280) await page.getByRole("tab", { name: "Conteúdo" }).click();
    }
    await page.getByRole("button", { name: "Gerar rascunho por IA" }).click();
    await expect(page.getByRole("status")).toContainText(/fila|andamento|succeeded/);
    await expect.poll(async () => page.getByLabel("Síntese do achado").inputValue()).toContain("generated draft");
});
