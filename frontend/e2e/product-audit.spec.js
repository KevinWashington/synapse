import { expect, test } from "@playwright/test";
import path from "node:path";

const evidenceDir = path.resolve("../docs/audits/playwright-2026-10-06");

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

test.describe("anonymous access", () => {
  test("redirects to the Google-only login", async ({ context, page }, testInfo) => {
    await context.clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entre no Synapse" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(page.getByLabel("Senha")).toHaveCount(0);
    await expect(page.getByText(/Google ainda nao configurado/)).toBeVisible();
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

    await page.goto("/");
    await settle(page);
    await expect(page.getByText(/Bem-vindo,/)).toBeVisible();
    await expect(page.getByText("Total de Projetos")).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-02-dashboard.png`), fullPage: true });

    await page.goto("/projetos");
    await settle(page);
    await expect(page.getByRole("heading", { name: "Projetos", exact: true })).toBeVisible();
    const firstProject = page.locator('[data-testid="project-open"]:visible').first();
    await expect(firstProject).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-03-projects.png`), fullPage: true });

    await firstProject.click();
    await settle(page);
    await expect(page.getByRole("button", { name: "Planejamento", exact: true })).toBeVisible();
    await expect(page.getByText(/Progresso da revis/)).toBeVisible({ timeout: 20_000 });
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
  });
});
