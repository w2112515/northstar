// Copy blacklist checker (DESIGN.md §copy): nautical metaphors and passive
// "waiting on you" phrasing must never reach user-visible text. Scans web
// source and API python for prose usage; identifier/data-key usage of
// "captain" (journal payload key, function names, env var) is allowed
// because renaming it would break stored journals.
//
// Usage: node scripts/check-copy.mjs   (exit 1 on any hit)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = [
  { dir: join(REPO, "apps/web/src"), exts: [".ts", ".tsx", ".css"] },
  { dir: join(REPO, "apps/api/northstar"), exts: [".py"] },
  { dir: join(REPO, "apps/api/tests"), exts: [".py"] },
];

const BANNED = [
  /\bvoyages?\b/i,
  /\bfleets?\b/i,
  /\bhelm\b/i,
  /\bsail(?:s|ed|ing)?\b/i,
  /\bcaptain(?:'s)?\b/i,
  /\bon board\b/i,
  /\bdock(?:ed|ing)?\b/i,
  /waiting on you/i,
];

// Lines where a banned word is legitimate, in priority order:
const ALLOW = [
  /Night Voyage/, //           palette name fixed by the design contract
  /Never call/, //             LLM guard prompts must name the banned words
  /(?:["'._]|_)captain/i, //   "captain" data key / _captain_* identifiers / env var
  /\bcaptain\s*[=.\[(,):?}]/, // bare identifier usage (captain = ..., isinstance(captain, ...))
];

const hits = [];
function walk(dir, exts) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === "__pycache__") continue;
      walk(p, exts);
    } else if (exts.some((e) => name.endsWith(e))) {
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const re of BANNED) {
          const m = line.match(re);
          if (!m) continue;
          if (ALLOW.some((a) => a.test(line))) continue;
          hits.push(`${p}:${i + 1}  [${m[0]}]  ${line.trim().slice(0, 120)}`);
          break;
        }
      });
    }
  }
}

for (const { dir, exts } of ROOTS) walk(dir, exts);

if (hits.length) {
  console.error(`copy blacklist: ${hits.length} hit(s)\n` + hits.join("\n"));
  process.exit(1);
}
console.log("copy blacklist: clean");
