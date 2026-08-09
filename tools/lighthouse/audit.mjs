import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

import { CATEGORIES, CHROME_FLAGS, RUNS, config } from "./config.mjs";

// One browser for the whole gate, not one per run. Chromium's startup is ~1.5s
// here and contributes nothing to any score.
export async function withBrowser(fn) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: CHROME_FLAGS,
    chromePath: process.env.CHROME_PATH,
  });

  try {
    return await fn(chrome.port);
  } finally {
    await chrome.kill();
  }
}

async function once(url, port) {
  const result = await lighthouse(
    url,
    { port, output: "json", logLevel: "error" },
    config,
  );

  if (!result) {
    throw new Error(`Lighthouse returned nothing for ${url}`);
  }

  return result.lhr;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}

// Scores are the median across runs, per category. The report kept alongside is
// the run whose performance score is the median one, so the audit detail a
// failure prints belongs to a real run and not to a synthetic average of three.
export async function audit(url, port) {
  const runs = [];

  for (let n = 0; n < RUNS; n += 1) {
    runs.push(await once(url, port));
  }

  const scores = {};
  for (const id of CATEGORIES) {
    scores[id] = median(runs.map((lhr) => lhr.categories[id].score));
  }

  const representative =
    runs.find((lhr) => lhr.categories.performance.score === scores.performance) ??
    runs[0];

  return { url, scores, lhr: representative, runs };
}
