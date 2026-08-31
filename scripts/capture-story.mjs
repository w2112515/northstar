/**
 * capture-story.mjs - the six "story" screenshots for submissions/social.
 *
 * Usage: node scripts/capture-story.mjs [--only red,evolution,cockpit,rejection,a2a,positions]
 *
 * Sources (each shot names its instance honestly):
 *   LOCAL   http://127.0.0.1:3000            cockpit wired to the VPS competition API
 *   VPS     http://160.202.133.144:3000      public read-only cockpit (no admin token)
 *   CLOUD   Cloud Run demo (dev account)     journal has real gate rejections
 *
 * Output: artifacts/story/<name>.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL = "http://127.0.0.1:3000";
const VPS = "http://160.202.133.144:3000";
const CLOUD = "https://northstar-web-251608445238.us-central1.run.app";

const OUT = resolve("artifacts/story");
mkdirSync(OUT, { recursive: true });

const onlyArg = process.argv.find((a) => a.startsWith("--only"));
const only = onlyArg ? (onlyArg.split("=")[1] ?? process.argv[process.argv.indexOf(onlyArg) + 1]).split(",") : null;
const want = (k) => !only || only.includes(k);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page) {
  await page
    .waitForFunction(
      () => !document.querySelector(".skel") && !document.body.innerText.includes("syncing…"),
      { timeout: 45000 },
    )
    .catch(() => console.log("  (settle timeout - capturing as-is)"));
  await sleep(1500);
}

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`  ✓ ${name}.png`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. red-light goal: the system saying NO with honest alternatives
if (want("red")) {
  await page.goto(`${LOCAL}/onboarding`, { waitUntil: "load", timeout: 60000 });
  await settle(page);
  await page.locator("#tgt").fill("2000000");
  await sleep(300);
  await page.getByRole("button", { name: "Continue" }).click();
  await sleep(400);
  await page.getByRole("button", { name: "See the honest plan" }).click();
  await page.getByText("The honest plan").waitFor({ timeout: 60000 });
  await sleep(800);
  await shot(page, "1-red-light-goal");
}

// 2. gate rejection in the journal (cloud demo carries real rejected verdicts)
if (want("rejection")) {
  await page.goto(`${CLOUD}/journal`, { waitUntil: "load", timeout: 60000 });
  await settle(page);
  await page.getByRole("button", { name: "verdict", exact: true }).click();
  await sleep(600);
  await shot(page, "2-gate-rejection", false);
}

// 3. real option spread positions (needs an open session first - rerun after)
if (want("positions")) {
  await page.goto(`${LOCAL}/`, { waitUntil: "load", timeout: 60000 });
  await settle(page);
  await shot(page, "3-spread-positions");
}

// 4. evolution lineage (challengers vs champion, walk-forward verdicts)
if (want("evolution")) {
  await page.goto(`${LOCAL}/research?tab=evolution`, { waitUntil: "load", timeout: 60000 });
  await settle(page);
  await shot(page, "4-evolution-lineage");
}

// 5. the public read-only cockpit itself (what judges can open)
if (want("cockpit")) {
  await page.goto(`${VPS}/`, { waitUntil: "load", timeout: 60000 });
  await settle(page);
  await shot(page, "5-readonly-cockpit");
}

// 6. A2A agent card (machine-readable agent surface) - the real payload,
// rendered as a terminal-style pretty print for legibility
if (want("a2a")) {
  const url = `${CLOUD}/a2a/weather/.well-known/agent-card.json`;
  const card = await (await fetch(url)).json();
  const pretty = JSON.stringify(card, null, 2)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  await page.setContent(`
    <body style="margin:0;background:#0b0f17;color:#c9d4e3;font:13px/1.55 ui-monospace,Consolas,monospace">
      <div style="padding:28px 34px">
        <div style="color:#8b98ab;margin-bottom:14px">$ curl ${url.replace("https://", "")}</div>
        <pre style="margin:0;white-space:pre-wrap">${pretty}</pre>
      </div>
    </body>`);
  await sleep(300);
  await shot(page, "6-a2a-agent-card");
}

await browser.close();
console.log(`done → ${OUT}`);
