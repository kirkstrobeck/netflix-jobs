import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import defaultConfig from "lighthouse/core/config/default-config.js";

import { audit, withBrowser } from "./audit.mjs";
import { CATEGORIES, FORM_FACTOR, PASSING, RUNS } from "./config.mjs";
import { explainFailures, scoreTable, toScore } from "./report.mjs";
import { build, start, warm } from "./server.mjs";
import { targets } from "./targets.mjs";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const PORT = Number(process.env.LIGHTHOUSE_PORT ?? 3210);

// Chromium first, so a fresh container needs no preparation. The script is a
// no-op when the browser already runs; see tools/chromium/README.md.
function prepareBrowser() {
  execFileSync("bash", [`${REPO_ROOT}tools/chromium/install.sh`], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  const { chromePath, env } = JSON.parse(
    readFileSync(`${REPO_ROOT}.cache/chromium/env.json`, "utf8"),
  );

  process.env.CHROME_PATH = chromePath;
  Object.assign(process.env, env);
}

// A Lighthouse upgrade that adds a category must not quietly go unmeasured --
// the whole point of the gate is "100 across every category it reports". This
// compares the list we score against the list the installed version defines.
function assertCategoriesCovered() {
  const reported = Object.keys(defaultConfig.categories);
  const missing = reported.filter((id) => !CATEGORIES.includes(id));
  const stale = CATEGORIES.filter((id) => !reported.includes(id));

  if (missing.length || stale.length) {
    throw new Error(
      `tools/lighthouse/config.mjs is out of date with this Lighthouse.\n` +
        `  not scored: ${missing.join(", ") || "none"}\n` +
        `  no longer reported: ${stale.join(", ") || "none"}`,
    );
  }
}

// The whole median run, on disk, every time -- pass or fail. A gate that only
// prints numbers makes the next person re-run a two-minute job to see anything;
// this way the trace, the network log and every audit's details are already
// there. Drop the file into the Lighthouse Viewer to read it as a report.
function saveReports(results) {
  const dir = `${REPO_ROOT}.cache/lighthouse`;
  mkdirSync(dir, { recursive: true });

  for (const result of results) {
    const name = result.label.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    writeFileSync(`${dir}/${name}.json`, JSON.stringify(result.lhr, null, 2));
  }

  console.log(`\nreports: ${dir}/`);
}

// Where the bytes come from. Against a deployed origin there is nothing to
// build, nothing to start and nothing to stop -- and, more to the point, the
// numbers then describe what visitors actually get: Vercel's compression, its
// CDN cache, the real TLS handshake. A local `next start` measures none of
// that. LIGHTHOUSE_ORIGIN=https://... switches the same gate onto it.
async function origin() {
  const deployed = process.env.LIGHTHOUSE_ORIGIN;

  if (deployed) {
    return { url: deployed.replace(/\/+$/, ""), stop: async () => {} };
  }

  if (!process.env.LIGHTHOUSE_SKIP_BUILD) {
    await build();
  }

  const local = await start(PORT);

  return { url: `http://127.0.0.1:${PORT}`, stop: () => local.stop() };
}

async function main() {
  assertCategoriesCovered();
  prepareBrowser();

  const server = await origin();
  const pages = await targets(server.url);

  const results = [];
  try {
    await warm(pages.map((page) => page.url));
    await withBrowser(async (port) => {
      for (const page of pages) {
        const outcome = await audit(page.url, port);
        results.push({ ...outcome, label: page.label });
      }
    });
  } finally {
    await server.stop();
  }

  console.log(`\nlighthouse ${RUNS} runs/page, median score, ${FORM_FACTOR} simulated`);
  console.log(scoreTable(results));
  saveReports(results);

  const failed = results.filter((result) =>
    CATEGORIES.some((id) => toScore(result.scores[id]) < PASSING),
  );

  if (failed.length === 0) {
    console.log(`\nall categories at ${PASSING}`);
    return;
  }

  console.log(`\n${"=".repeat(60)}\nfailing audits\n${"=".repeat(60)}`);
  console.log(explainFailures(failed));
  process.exitCode = 1;
}

await main();
