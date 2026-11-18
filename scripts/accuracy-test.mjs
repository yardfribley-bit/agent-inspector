#!/usr/bin/env node
/**
 * Bot Detection Accuracy Test (Acceptance Criterion #4)
 *
 * Launches several browser "visitor types" against the deployed Agent Inspector
 * and prints how each was classified. Verifies that automation is detected.
 *
 * Usage (on a machine with the app running):
 *   node scripts/accuracy-test.mjs
 *
 * Set TARGET_URL env var to override the target (default: http://localhost:3000/agent-inspector).
 *
 * NOTE: A true "human browser" cannot be simulated on a server/CI machine —
 * datacenter IP + VM + automation driver are real bot signals. To check for
 * false positives (humans misclassified as bots), open the URL in your OWN
 * laptop browser and confirm it shows "Human (人类浏览器)".
 */
import puppeteer from "puppeteer";

const TARGET_URL = process.env.TARGET_URL || "http://localhost:3000/agent-inspector";
const REAL_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

const scenarios = [
  {
    name: "Plain headless Chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    ua: null,
    expectBot: true,
  },
  {
    name: "Headless + real-looking User-Agent",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    ua: REAL_UA,
    expectBot: true,
  },
  {
    name: "Anti-detect (AutomationControlled disabled + spoofed webdriver)",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
    ua: REAL_UA,
    expectBot: true,
  },
];

async function inspect(scenario) {
  const browser = await puppeteer.launch({ headless: "new", args: scenario.args });
  const page = await browser.newPage();
  if (scenario.ua) await page.setUserAgent(scenario.ua);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction(
    () => document.body.innerText.includes("Copy JSON Report"),
    { timeout: 30000 }
  );

  const result = await page.evaluate(() => {
    const lines = document.body.innerText.split("\n");
    const grab = (label) => {
      const i = lines.findIndex((l) => l.trim() === label);
      return i >= 0 ? (lines[i + 1] || "").trim() : "N/A";
    };
    // The visitor-type badge is the line right after the card title
    const titleIdx = lines.findIndex((l) => l.trim() === "AI AGENT / BOT 识别");
    return {
      visitorType: titleIdx >= 0 ? (lines[titleIdx + 1] || "").trim() : "N/A",
      verdict: grab("Bot 判定 (verdict)"),
      category: grab("Bot Category"),
      botType: grab("Bot 子类型"),
      name: grab("Agent 名称"),
      confidence: (document.body.innerText.match(/置信度:\s*(\w+)/) || [])[1] || "N/A",
      suspectScore: grab("可疑分数 (suspect score)"),
      vmML: grab("虚拟机 ML 置信度"),
    };
  });

  await browser.close();
  return result;
}

(async () => {
  let passed = 0;
  for (const s of scenarios) {
    try {
      const r = await inspect(s);
      const detectedAsBot =
        /Bot/.test(r.visitorType) && r.verdict === "bad";
      const ok = s.expectBot ? detectedAsBot : !detectedAsBot;
      if (ok) passed++;
      console.log(`\n[${ok ? "PASS" : "FAIL"}] ${s.name}`);
      console.log(`  visitor: ${r.visitorType} | verdict: ${r.verdict} | type: ${r.botType}`);
      console.log(`  name: ${r.name} | confidence: ${r.confidence} | suspect: ${r.suspectScore} | VM: ${r.vmML}`);
    } catch (e) {
      console.log(`\n[ERROR] ${s.name}: ${e.message}`);
    }
  }
  console.log(`\n=== ${passed}/${scenarios.length} automation scenarios correctly detected ===`);
  console.log("NOTE: Verify false positives by opening the URL in your real laptop browser.");
  process.exit(passed === scenarios.length ? 0 : 1);
})();
