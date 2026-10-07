import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const apiBaseUrl = "http://localhost:5000";
const csrfToken = "playwright-csrf";
const evidenceDir = path.resolve("../docs/audits/playwright-ui-consistency-2026-10-07");

fs.mkdirSync(evidenceDir, { recursive: true });

async function authenticate(context) {
  const token = process.env.E2E_SESSION_TOKEN;
  test.skip(!token, "E2E_SESSION_TOKEN is required for authenticated flows");
  await context.addCookies([
    { name: "synapse_session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "synapse_session_csrf", value: csrfToken, domain: "localhost", path: "/", sameSite: "Lax" },
  ]);
}

async function createProject(request, title) {
  const response = await request.post(`${apiBaseUrl}/api/projetos`, {
    data: {
      title,
      objetivo: "Validar edição segura e navegação do planejamento.",
      status: "em-progresso",
      framework: "PICO",
      picoc: {
        population: "População inicial",
        intervention: "Intervenção inicial",
        comparison: "Comparação inicial",
        outcome: "Resultado inicial",
      },
    },
    headers: { "X-CSRF-Token": csrfToken },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test.describe("planning navigation safety", () => {
  test.beforeEach(async ({ context }) => authenticate(context));

  test("warns before leaving, preserves edits on cancel, and saves explicitly", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const project = await createProject(
      page.request,
      `Auditoria do planejamento ${testInfo.project.name} ${Date.now()}`
    );

    try {
      await page.goto(`/projetos/${project.id}?tab=planejamento`);
      await expect(page.getByRole("button", { name: "Abrir menu da conta" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Planejamento", exact: true })).toHaveAttribute("aria-current", "page");

      const population = page.getByLabel("População");
      await expect(population).toBeVisible();
      await population.fill("População alterada no Playwright");
      await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-planning-dirty.png`), fullPage: true });

      await page.getByRole("button", { name: "Artigos", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Sair sem salvar?" })).toBeVisible();
      await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-planning-confirmation.png`), fullPage: true });

      await page.getByRole("button", { name: "Continuar editando" }).click();
      await expect(population).toHaveValue("População alterada no Playwright");
      await expect(page.getByRole("button", { name: "Planejamento", exact: true })).toHaveAttribute("aria-current", "page");

      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByText("Alterações não salvas", { exact: true })).toHaveCount(0);
      await expect(population).toHaveValue("População alterada no Playwright");

      await page.getByRole("button", { name: "Artigos", exact: true }).click();
      await expect(page.getByRole("button", { name: "Exportar dados" })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/projetos/${project.id}\\?tab=artigos`));
      await page.screenshot({ path: path.join(evidenceDir, `${testInfo.project.name}-planning-saved-navigation.png`), fullPage: true });
    } finally {
      await page.request.delete(`${apiBaseUrl}/api/projetos/${project.id}`, {
        headers: { "X-CSRF-Token": csrfToken },
      });
    }
  });
});
