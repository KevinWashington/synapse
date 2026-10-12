import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseURL = process.argv[2] || "https://synapse.labit.dev.br";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const insecureRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (request.url().startsWith("http://") && request.resourceType() !== "document") {
    insecureRequests.push(request.url());
  }
});

try {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  if (new URL(baseURL).hostname === "synapse.labit.dev.br") {
    assert.equal(new URL(page.url()).protocol, "https:", "Production must redirect to HTTPS");
    assert.deepEqual(insecureRequests, [], "Production must not load HTTP subresources");
  }
  await page.locator("h1").waitFor({ state: "visible", timeout: 15_000 });
  assert.deepEqual(errors, [], "The production bundle must execute without runtime errors");
  assert.equal(await page.title(), "Synapse");
  assert.match(await page.locator("body").innerText(), /Entre com sua conta Google/);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("h1").waitFor({ state: "visible" });
  assert.deepEqual(errors, [], "Reload must also render without runtime errors");
  console.log(`PASS: rendered login, title, reload and no JavaScript runtime errors (${baseURL})`);
} finally {
  console.log("PAGE_ERRORS:", JSON.stringify(errors));
  console.log("TITLE:", await page.title());
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/production-smoke.png", fullPage: true });
  await browser.close();
}
