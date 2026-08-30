/**
 * capture-ui.mjs - screenshot every NorthStar surface for visual audit rounds.
 *
 * Usage:  node scripts/capture-ui.mjs [baseUrl] [outDir]
 * Deps:   npx playwright (chromium). Dev server + API must be running.
 *
 * Output: artifacts/ui-attack/<name>.png  (gitignored)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const OUT = resolve(process.argv[3] ?? "artifacts/ui-attack");
mkdirSync(OUT, { recursive: true });

// SWR polls keep the network busy forever, so "networkidle" never fires.
// Load + a fixed settle window is the reliable option here.
const SETTLE_MS = 7000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name, { fullPage = true } = {}) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`  ✓ ${name}.png`);
}

async function goto(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60000 });
  await sleep(SETTLE_MS);
}

const browser = await chromium.launch();

// ---------------------------------------------------------------- desktop
console.log("desktop 1280x900");
const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await goto(desktop, "/");
await shot(desktop, "overview");

for (const tab of ["radar", "compass", "evolution", "mining"]) {
  await goto(desktop, tab === "radar" ? "/research" : `/research?tab=${tab}`);
  await shot(desktop, `research-${tab}`);
}

await goto(desktop, "/strategies");
await shot(desktop, "strategies");

await goto(desktop, "/journal");
await shot(desktop, "journal");

// ------------------------------------------------------------- onboarding
// Step content is client state; walk the wizard with the default (sane) goal.
console.log("onboarding walk");
await goto(desktop, "/onboarding");
await shot(desktop, "onboarding-1");

await desktop.getByRole("button", { name: "Continue" }).click();
await sleep(400);
await shot(desktop, "onboarding-2");

await desktop.getByRole("button", { name: "See the honest plan" }).click();
await desktop.getByText("The honest plan").waitFor({ timeout: 60000 });
await sleep(800);
await shot(desktop, "onboarding-3");

await desktop.getByRole("button", { name: "Continue" }).click();
await sleep(400);
await shot(desktop, "onboarding-4");
// NOTE: never click "Start the plan" - commit mutates real goal state.

// Red path: an absurd destination forces feasibility=red honest alternatives.
await goto(desktop, "/onboarding");
await desktop.locator("#tgt").fill("2000000");
await sleep(300);
await desktop.getByRole("button", { name: "Continue" }).click();
await sleep(400);
await desktop.getByRole("button", { name: "See the honest plan" }).click();
await desktop.getByText("The honest plan").waitFor({ timeout: 60000 });
await sleep(800);
await shot(desktop, "onboarding-red");

await desktop.close();

// ----------------------------------------------------------------- mobile
console.log("mobile 390x844 spot-check");
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });

await goto(mobile, "/");
await shot(mobile, "m-overview");

await goto(mobile, "/journal");
await shot(mobile, "m-journal");

await mobile.close();
await browser.close();
console.log(`done → ${OUT}`);
