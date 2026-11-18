/**
 * Playwright smoke test for Agent Inspector.
 *
 * Verifies the page renders under automation and that the detection cards
 * appear (the bot should be correctly identified as automation).
 *
 * Usage:
 *   npm install -D @playwright/test && npx playwright install chromium
 *   node scripts/playwright-test.mjs
 *
 * Override target with TARGET_URL env var.
 * Default target includes basePath (/agent-inspector) for the deployed app;
 * for local dev use TARGET_URL=http://localhost:3000/agent-inspector
 */
import { chromium } from "playwright";

const TARGET_URL =
  process.env.TARGET_URL || "http://localhost:3000/agent-inspector";

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("[test] Navigating to", TARGET_URL);
  await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });

  // Wait for result (success cards or error panel), not the loading skeleton
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes("Copy JSON Report") || t.includes("检测失败");
    },
    { timeout: 20000 }
  );

  const title = await page.title();
  console.log("[test] Page title:", title);

  const cards = await page.locator("h3").allTextContents();
  console.log("[test] Cards rendered:", cards.length, "->", cards);

  const bodyText = await page.locator("body").innerText();
  const isError = bodyText.includes("检测失败");
  const isBot =
    bodyText.includes("Browser Bot / Automation") ||
    bodyText.includes("AI Agent") && bodyText.includes("bad");

  console.log("[test] Error state:", isError);
  console.log("[test] Automation correctly detected:", isBot);

  // Expand raw JSON if present
  const rawButton = page.getByRole("button", { name: /原始响应|Raw JSON/ });
  if ((await rawButton.count()) > 0) {
    await rawButton.click();
    await page.waitForTimeout(400);
    const rawText = await page.locator("pre").first().innerText().catch(() => "");
    console.log("[test] Raw JSON chars:", rawText.length);
  }

  await browser.close();

  const pass = cards.length >= 4 && !isError && isBot;
  console.log(pass ? "[test] PASS" : "[test] FAIL");
  if (!pass) process.exitCode = 1;
}

runTest().catch((err) => {
  console.error("[test] ERROR:", err.message);
  process.exit(1);
});
