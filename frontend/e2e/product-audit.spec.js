import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const evidenceDir = path.resolve("../docs/audits/playwright-ui-consistency-2026-10-07");
const apiBaseUrl = "http://localhost:5000";
const csrfToken = "playwright-csrf";

fs.mkdirSync(evidenceDir, { recursive: true });

async function authenticate(context) {
  const token = process.env.E2E_SESSION_TOKEN;
  test.skip(!token, "E2E_SESSION_TOKEN is required for authenticated flows");
  await context.addCookies([
    { name: "synapse_session", value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "synapse_session_csrf", value: "playwright-csrf", domain: "127.0.0.1", path: "/", sameSite: "Lax" },
    { name: "synapse_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "synapse_session_csrf", value: "playwright-csrf", domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).not.toContainText("Carregando página...");
}

async function deleteProject(request, projectId) {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await request.delete(`${apiBaseUrl}/api/projetos/${projectId}`, {
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (response.ok() || response.status() === 404) return;
      lastError = new Error(`Project cleanup failed with status ${response.status()}: ${await response.text()}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError;
}

test.describe("anonymous access", () => {
  test("redirects to the Google-only login", async ({ context, page }, testInfo) => {
    await context.clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Transforme pesquisa em evidência confiável." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Acesse seu espaço de revisão" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(page.getByLabel("Senha")).toHaveCount(0);
    await expect.poll(async () => (
      await page.getByRole("button", { name: /Continuar com o Google/i }).count()
      + await page.getByText(/Google ainda nao configurado/).count()
    )).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-01-login.png`), fullPage: true });
  });
});

test.describe("authenticated product flow", () => {
  test.beforeEach(async ({ context }) => authenticate(context));

  test("dashboard, projects, project workspace and settings remain usable", async ({ page }, testInfo) => {
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });

    const createResponse = await page.request.post(`${apiBaseUrl}/api/projetos`, {
      data: {
        title: `Auditoria isolada do produto ${testInfo.project.name} ${Date.now()}`,
        objetivo: "Validar as superficies principais sem depender de outro teste em execucao.",
        status: "em-progresso",
      },
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
    const project = await createResponse.json();

    try {
    await page.goto("/");
    await settle(page);
    await expect(page.getByText(/Bem-vindo,/)).toBeVisible();
    await expect(page.getByText("Total de Projetos")).toBeVisible();
    await expect(page.getByRole("button", { name: /Ativos/ })).toBeVisible();
    await expect(page.getByText("In Progress", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-02-dashboard.png`), fullPage: true });

    await page.goto("/projetos");
    await settle(page);
    await expect(page.getByRole("heading", { name: "Projetos", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Ordenar projetos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lixeira" })).toHaveCount(0);
    if (testInfo.project.name === "mobile-chromium") {
      await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    }
    const homeLink = page.getByRole("link", { name: "Início", exact: true });
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Total de Projetos")).toBeVisible();
    await page.goto("/projetos");
    await settle(page);
    const auditProject = testInfo.project.name === "mobile-chromium"
      ? page.locator("article").filter({ has: page.getByRole("heading", { name: project.title, exact: true }) }).getByRole("button", { name: "Abrir projeto" })
      : page.getByTestId("project-open").filter({ hasText: project.title });
    await expect(auditProject).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-03-projects.png`), fullPage: true });

    await auditProject.click();
    await settle(page);
    await expect(page.getByRole("button", { name: "Planejamento", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menu da conta" })).toBeVisible();
    await expect(page.getByText(/Progresso da revis/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Identificação", { exact: true })).toBeVisible();
    await expect(page.getByText("Ações rápidas", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-04-project-overview.png`), fullPage: true });
    await page.getByRole("button", { name: "Artigos", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exportar dados" })).toBeVisible();
    await expect(page.getByText("Carregando artigos...")).not.toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Processando etapa...")).not.toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-05-project-articles.png`) });

    await page.goto("/settings");
    await settle(page);
    await expect(page.getByText("Integração com DeepSeek")).toBeVisible();
    await expect(page.getByText(/opcional/i)).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-06-settings.png`), fullPage: true });

    await testInfo.attach("browser-errors", {
      body: Buffer.from(browserErrors.join("\n") || "none"),
      contentType: "text/plain",
    });
    expect(browserErrors.filter((message) => !message.includes("favicon"))).toEqual([]);
    } finally {
      await deleteProject(page.request, project.id);
    }
  });
});
