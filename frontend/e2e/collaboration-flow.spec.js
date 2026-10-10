import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const apiBaseUrl = "http://localhost:5000";
const csrfToken = "playwright-csrf";
const evidenceDir = path.resolve("../docs/audits/playwright-project-collaboration-2026-10-08");
const actorIds = { owner: 1, reviewer: 2, peer: 3, coordinator: 4 };

fs.mkdirSync(evidenceDir, { recursive: true });

function requiredToken(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; collaboration E2E must not be skipped.`);
  return value;
}

const tokens = {
  owner: () => requiredToken("E2E_SESSION_TOKEN"),
  reviewer: () => requiredToken("E2E_REVIEWER_TOKEN"),
  peer: () => requiredToken("E2E_PEER_TOKEN"),
  coordinator: () => requiredToken("E2E_COORDINATOR_TOKEN"),
};

async function authenticate(context, token) {
  await context.addCookies([
    { name: "synapse_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "synapse_session_csrf", value: csrfToken, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function api(request, method, endpoint, data, expected = 200) {
  const response = await request[method](`${apiBaseUrl}${endpoint}`, {
    ...(data === undefined ? {} : { data }),
    headers: { "X-CSRF-Token": csrfToken },
  });
  expect(response.status(), `${method.toUpperCase()} ${endpoint}: ${await response.text()}`).toBe(expected);
  if (expected === 204) return null;
  return response.json();
}

async function capture(page, testInfo, number, name, fullPage = false) {
  const file = path.join(evidenceDir, `${testInfo.project.name}-${number}-${name}.png`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage });
  await testInfo.attach(`${number}-${name}`, { path: file, contentType: "image/png" });
}

async function createProject(request, title) {
  return api(request, "post", "/api/projetos", {
    title,
    objetivo: "Validar colaboração de um a N revisores sem alterar projetos existentes.",
    status: "em-progresso",
    researchQuestions: ["O estudo responde à pergunta da revisão?"],
    criteriosInclusao: ["Estudo relacionado ao tema"],
    criteriosExclusao: ["Estudo fora do escopo"],
    eligibilityChecklist: ["O texto completo responde à pergunta?"],
    dataExtractionSchema: [{ key: "resultado", label: "Resultado principal", type: "text", options: [] }],
  }, 201);
}

async function createScreeningCorpus(request, projectId, prefix, count = 23) {
  const entries = Array.from({ length: count }, (_, index) => ({
    title: `${prefix} ${String(index + 1).padStart(2, "0")}`,
    authors: `Autor ${index + 1}`,
    year: 2026,
    journal: "Journal de Colaboração",
    doi: `10.8800/${projectId}-${index + 1}`,
    abstract: `Resumo controlado do estudo ${index + 1}.`,
  }));
  const imported = await api(
    request,
    "post",
    `/api/projetos/${projectId}/artigos/import-bibtex?evaluate_ai=false&generate_embeddings=false`,
    { sourceCategory: "database", sourceName: "Scopus", importBatchLabel: "playwright-collaboration", entries },
    200,
  );
  await api(request, "post", `/api/projetos/${projectId}/artigos/promote-unique-to-screening`, {}, 200);
  return imported.articleIds;
}

async function inviteViaUi(page, email, role = "Revisor", participates = true) {
  await page.getByRole("button", { name: "Convidar pessoa" }).click();
  const dialog = page.getByRole("dialog", { name: "Convidar pessoa" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "E-mail" }).fill(email);
  if (role !== "Revisor") {
    await dialog.getByRole("combobox", { name: "Papel" }).click();
    await page.getByRole("option", { name: role }).click();
    const participation = dialog.getByRole("checkbox", { name: "Participa da revisão" });
    if ((await participation.isChecked()) !== participates) await participation.click();
  }
  await dialog.getByRole("button", { name: "Enviar convite" }).click();
  await expect(dialog).not.toBeVisible();
}

async function acceptProjectInvitation(request, projectId) {
  const invitations = await api(request, "get", "/api/invitations");
  const invitation = invitations.find((item) => item.projectId === projectId);
  expect(invitation).toBeTruthy();
  return api(request, "post", `/api/invitations/${invitation.id}/accept`, {});
}

function articleAssignments(assignments, articleId, phase = "screening") {
  return assignments.filter((entry) => entry.articleId === articleId && entry.phase === phase && entry.status !== "cancelled");
}

function actorForUser(userId) {
  const entry = Object.entries(actorIds).find(([, id]) => id === userId);
  if (!entry) throw new Error(`No E2E actor configured for user ${userId}`);
  return entry[0];
}

test.describe("collaborative review workflow", () => {
  test("supports solo and multi-reviewer projects end to end", async ({ context, page }, testInfo) => {
    test.setTimeout(360_000);
    const createdProjects = [];
    const browserErrors = [];
    const suffix = `${testInfo.project.name}-${Date.now()}`;
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    await authenticate(context, tokens.owner());

    try {
      const solo = await createProject(page.request, `E2E solo ${suffix}`);
      createdProjects.push(solo.id);
      const [soloArticle] = await createScreeningCorpus(page.request, solo.id, `Solo ${suffix}`, 1);
      const onePreview = await api(page.request, "post", `/api/projetos/${solo.id}/assignments/preview`, { phase: "screening" });
      expect(onePreview.reviewerCount).toBe(1);
      expect(onePreview.assignments).toEqual([{ articleId: soloArticle, reviewerUserId: actorIds.owner, slot: 1 }]);
      const soloDecision = await api(page.request, "post", `/api/projetos/${solo.id}/artigos/${soloArticle}/screening-decision`, {
        decision: "included", reasonText: "Fluxo solo preservado.",
      });
      expect(soloDecision.currentPhase).toBe("eligibility");

      const project = await createProject(page.request, `E2E colaboração ${suffix}`);
      createdProjects.push(project.id);
      const articleIds = await createScreeningCorpus(page.request, project.id, `Colaboração ${suffix}`);

      await page.goto(`/projetos/${project.id}?tab=equipe`);
      await expect(page.getByRole("heading", { name: "Equipe do projeto" })).toBeVisible();
      await inviteViaUi(page, "test@example.com");
      await inviteViaUi(page, "avaliador.pa1@gmail.com");
      await inviteViaUi(page, "colega.revisor@example.com", "Coordenador", false);
      await authenticate(context, tokens.reviewer());
      await acceptProjectInvitation(page.request, project.id);
      await authenticate(context, tokens.peer());
      await acceptProjectInvitation(page.request, project.id);
      await authenticate(context, tokens.coordinator());
      await acceptProjectInvitation(page.request, project.id);
      await authenticate(context, tokens.owner());
      await page.goto(`/projetos/${project.id}?tab=equipe`);
      await expect(page.getByText("Test User", { exact: true })).toBeVisible();
      await capture(page, testInfo, "01", "team-overview");

      const pendingEmail = `claim-${suffix}@example.com`;
      await page.getByRole("button", { name: "Convidar pessoa" }).click();
      const invitationDialog = page.getByRole("dialog", { name: "Convidar pessoa" });
      await invitationDialog.getByRole("textbox", { name: "E-mail" }).fill(pendingEmail);
      await invitationDialog.getByRole("combobox", { name: "Papel" }).click();
      await page.getByRole("option", { name: "Coordenador" }).click();
      await invitationDialog.getByRole("checkbox", { name: "Participa da revisão" }).uncheck();
      await capture(page, testInfo, "02", "invitation-dialog");
      await invitationDialog.getByRole("button", { name: "Enviar convite" }).click();
      await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Convites/ }).click();
      await expect(page.getByText(pendingEmail, { exact: true })).toBeVisible();
      const claimed = { token: tokens.reviewer() };
      expect(claimed.token).toBeTruthy();

      const previewButton = page.getByRole("button", { name: "Pré-visualizar distribuição" });
      await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Distribuição/ }).click();
      await previewButton.click();
      await expect(page.getByText(/23 artigos · 3 revisores/)).toBeVisible();
      await capture(page, testInfo, "03", "distribution-preview");
      await page.getByRole("button", { name: "Confirmar distribuição" }).click();
      await expect(page.getByText("Distribuição confirmada.")).toBeVisible();
      await previewButton.click();
      await expect(page.getByText("Nenhum artigo disponível para distribuir nesta etapa.")).toBeVisible();

      let assignments = await api(page.request, "get", `/api/projetos/${project.id}/assignments`);
      expect(assignments.filter((entry) => entry.phase === "screening")).toHaveLength(46);
      for (const articleId of articleIds) {
        const pair = articleAssignments(assignments, articleId);
        expect(pair).toHaveLength(2);
        expect(new Set(pair.map((entry) => entry.reviewerUserId)).size).toBe(2);
      }

      const agreementArticle = articleIds[0];
      const [firstAssignment, secondAssignment] = articleAssignments(assignments, agreementArticle);
      const firstActor = actorForUser(firstAssignment.reviewerUserId);
      const secondActor = actorForUser(secondAssignment.reviewerUserId);
      await authenticate(context, tokens[firstActor]());
      await api(page.request, "post", `/api/projetos/${project.id}/artigos/${agreementArticle}/screening-decision`, {
        decision: "included", reasonText: "Primeira decisão privada.",
      });
      const ownWaiting = await api(page.request, "get", `/api/projetos/${project.id}/artigos/${agreementArticle}`);
      expect(ownWaiting.reviewState).toBe("waiting_for_reviewer");
      expect(ownWaiting.myReviewAssignment.status).toBe("submitted");
      await api(page.request, "post", `/api/projetos/${project.id}/artigos/${agreementArticle}/screening-decision`, {
        decision: "included", reasonText: "Tentativa repetida.",
      }, 409);
      await page.goto(`/projetos/${project.id}/artigos/${agreementArticle}?flow=screening`);
      await expect(page.getByText("Aguardando outro revisor", { exact: true }).first()).toBeVisible();
      await capture(page, testInfo, "04", "reviewer-blind-waiting");

      await authenticate(context, tokens[secondActor]());
      const blinded = await api(page.request, "get", `/api/projetos/${project.id}/artigos/${agreementArticle}`);
      const firstVisible = blinded.reviewDecisions.find((entry) => entry.reviewerUserId === firstAssignment.reviewerUserId);
      expect(firstVisible).toEqual({ reviewerUserId: firstAssignment.reviewerUserId, status: "submitted" });
      const consolidated = await api(page.request, "post", `/api/projetos/${project.id}/artigos/${agreementArticle}/screening-decision`, {
        decision: "included", reasonText: "Segunda decisão igual.",
      });
      expect(consolidated.reviewState).toBe("consolidated");
      expect(consolidated.currentPhase).toBe("eligibility");

      await authenticate(context, tokens.owner());
      assignments = await api(page.request, "get", `/api/projetos/${project.id}/assignments`);
      const inherited = articleAssignments(assignments, agreementArticle, "eligibility");
      expect(inherited.map((entry) => entry.reviewerUserId).sort()).toEqual(
        [firstAssignment.reviewerUserId, secondAssignment.reviewerUserId].sort(),
      );

      const conflictArticle = articleIds.find((id) => {
        const pair = articleAssignments(assignments, id);
        return pair.length === 2 && pair.every((entry) => entry.status === "pending");
      });
      const [conflictFirst, conflictSecond] = articleAssignments(assignments, conflictArticle);
      await authenticate(context, tokens[actorForUser(conflictFirst.reviewerUserId)]());
      await api(page.request, "post", `/api/projetos/${project.id}/artigos/${conflictArticle}/screening-decision`, {
        decision: "included", reasonText: "Inclui pela aderência.",
      });
      await authenticate(context, tokens[actorForUser(conflictSecond.reviewerUserId)]());
      const conflictState = await api(page.request, "post", `/api/projetos/${project.id}/artigos/${conflictArticle}/screening-decision`, {
        decision: "excluded", reasonText: "Exclui por população divergente.",
      });
      expect(conflictState.reviewState).toBe("conflict");

      await authenticate(context, tokens.coordinator());
      await page.goto(`/projetos/${project.id}?tab=equipe`);
      await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Discordâncias/ }).click();
      await expect(page.getByText("Aguardando arbitragem", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: new RegExp(`Inspecionar discordância do artigo ${conflictArticle}`) }).click();
      const conflictDialog = page.getByRole("dialog", { name: new RegExp(`Discordância do artigo ${conflictArticle}`) });
      await expect(conflictDialog.getByRole("button", { name: "Resolver discordância" })).toBeDisabled();
      await capture(page, testInfo, "05", "conflict-resolution");
      await conflictDialog.getByRole("textbox", { name: "Justificativa da arbitragem" }).fill("Arbitragem registrada após comparação independente.");
      await conflictDialog.getByRole("button", { name: "Resolver discordância" }).click();
      await expect(conflictDialog).not.toBeVisible();

      for (const assignment of [conflictFirst, conflictSecond]) {
        await authenticate(context, tokens[actorForUser(assignment.reviewerUserId)]());
        const { notifications } = await api(page.request, "get", "/api/inbox");
        expect(notifications.some((notification) => notification.type === "review_conflict_resolved" && notification.entityId === conflictArticle)).toBe(true);
      }

      await authenticate(context, tokens.reviewer());
      await page.goto(`/projetos/${project.id}?tab=artigos&flow=screening`);
      await page.getByRole("button", { name: "Atribuídos a mim", exact: true }).click();
      const assignedResponse = await api(page.request, "get", `/api/projetos/${project.id}/artigos?phase=screening&outcome=active&assignedToMe=true&page=1&limit=5`);
      expect(assignedResponse.total).toBeGreaterThan(assignedResponse.articles.length);
      expect(assignedResponse.articles.every((article) => article.myReviewAssignment?.reviewerUserId === actorIds.reviewer)).toBeTruthy();
      await capture(page, testInfo, "06", "assigned-to-me");

      assignments = await api(page.request, "get", `/api/projetos/${project.id}/assignments/me`);
      const assignedIds = new Set(assignments.filter((entry) => entry.phase === "screening").map((entry) => entry.articleId));
      const activeScreening = await api(page.request, "get", `/api/projetos/${project.id}/artigos?phase=screening&outcome=active&page=1&limit=1000`);
      const unassignedArticle = activeScreening.articles.find((article) => !assignedIds.has(article.id))?.id;
      expect(unassignedArticle).toBeTruthy();
      const readable = await api(page.request, "get", `/api/projetos/${project.id}/artigos/${unassignedArticle}`);
      expect(readable.canWriteReview).toBe(false);
      await api(page.request, "patch", `/api/projetos/${project.id}/artigos/${unassignedArticle}/notes`, { notas: "proibido" }, 403);
      await api(page.request, "post", `/api/projetos/${project.id}/artigos/${unassignedArticle}/screening-decision`, {
        decision: "included", reasonText: "proibido",
      }, 403);
      await api(page.request, "patch", `/api/projetos/${project.id}/artigos/${unassignedArticle}/full-text-status`, {
        fullTextStatus: "unavailable", reasonText: "proibido",
      }, 403);
      await api(page.request, "patch", `/api/projetos/${project.id}/artigos/${unassignedArticle}/evidence`, {
        extractionData: { resultado: "proibido" }, qualityAssessmentAnswers: {}, markExtractionComplete: false,
      }, 403);
      await api(page.request, "put", `/api/projetos/${project.id}/artigos/${unassignedArticle}`, { title: "proibido" }, 403);
      await api(page.request, "delete", `/api/projetos/${project.id}/artigos/${unassignedArticle}`, undefined, 403);
      const deniedPdf = await page.request.post(`${apiBaseUrl}/api/projetos/${project.id}/artigos/${unassignedArticle}/pdf`, {
        multipart: { file: { name: "proibido.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") } },
        headers: { "X-CSRF-Token": csrfToken },
      });
      expect(deniedPdf.status(), await deniedPdf.text()).toBe(403);
      await page.goto(`/projetos/${project.id}/artigos/${unassignedArticle}?flow=screening`);
      await expect(page.getByText("Somente leitura", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Registrar (triagem|elegibilidade)/ })).toBeDisabled();
      await capture(page, testInfo, "07", "unassigned-read-only");

      await page.goto(`/projetos/${project.id}?tab=equipe`);
      await expect(page.getByRole("button", { name: "Convidar pessoa" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Transferir propriedade/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Pré-visualizar distribuição/ })).toHaveCount(0);

      await authenticate(context, claimed.token);
      await page.goto(`/projetos/${project.id}?tab=equipe`);
      const bell = page.getByRole("button", { name: /Central de notificações, \d+ pendentes/ });
      await bell.click();
      await expect(page.getByText("Novas revisões atribuídas", { exact: true })).toBeVisible();
      await capture(page, testInfo, "08", "notification-panel");
      const markAll = page.getByRole("button", { name: "Marcar todas como lidas" });
      await markAll.click();
      await expect(markAll).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Central de notificações, 0 pendentes" })).toBeVisible();

      await authenticate(context, tokens.owner());
      await page.goto(`/projetos/${project.id}?tab=equipe`);
      await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Distribuição/ }).click();
      await page.getByRole("button", { name: "Pré-visualizar distribuição" }).click();
      const team = await api(page.request, "get", `/api/projetos/${project.id}/members`);
      const removable = team.members.find((member) => member.userId === actorIds.peer);
      await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Participantes/ }).click();
      await page.getByRole("button", { name: `Remover ${removable.name}` }).click();
      const removeDialog = page.getByRole("dialog", { name: "Remover pessoa?" });
      await removeDialog.getByRole("button", { name: "Remover pessoa" }).click();
      await expect(removeDialog).not.toBeVisible();
      await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Distribuição/ }).click();
      await expect(page.getByRole("button", { name: "Confirmar distribuição" })).toHaveCount(0);
      await page.reload();
      await page.getByRole("navigation", { name: "Seções da equipe" }).getByRole("button", { name: /Distribuição/ }).click();
      await expect(page.getByText(/vaga\(s\) precisa de reatribuição/)).toBeVisible();
      const reassign = page.getByRole("button", { name: /Reatribuir artigo/ }).first();
      const row = reassign.locator("xpath=ancestor::li");
      await row.getByRole("combobox").click();
      await page.getByRole("option").first().click();
      await reassign.click();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      expect(await page.getByText(/\b(In Progress|Review assigned|Team|Invite|Resolve conflict)\b/).count()).toBe(0);
      expect(browserErrors.filter((message) => !message.includes("favicon"))).toEqual([]);
    } finally {
      await authenticate(context, tokens.owner());
      for (const projectId of createdProjects.reverse()) {
        const response = await page.request.delete(`${apiBaseUrl}/api/projetos/${projectId}`, {
          headers: { "X-CSRF-Token": csrfToken },
        });
        expect([204, 404]).toContain(response.status());
      }
      await testInfo.attach("browser-errors", {
        body: Buffer.from(browserErrors.join("\n") || "none"), contentType: "text/plain",
      });
    }
  });
});
