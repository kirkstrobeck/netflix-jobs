// Two wrap.mjs snapshots, side by side.
//
// The point of the pair is that a text-wrap change is not obviously an
// improvement: `balance` equalises lines but is capped at a few of them in every
// engine, and past the cap it does nothing at all; `pretty` moves the LAST line
// and can leave the ones above it more ragged than it found them. So the rule is
// measure, change, measure the identical sweep again, and keep only what got
// better.
//
// Usage: node tools/probe/wrap-diff.mjs before.json after.json
//
// Rows are matched on page + width + selector + text, which is stable across a
// pure styling change. A row present in one file and not the other is reported
// rather than dropped -- that is a re-flow, and it is the interesting case.
import { readFileSync } from "node:fs";

const [beforePath, afterPath] = process.argv.slice(2);

const load = (path) => JSON.parse(readFileSync(path, "utf8"));
const key = (item) => `${item.page}|${item.width}|${item.selector}|${item.text}`;

const before = new Map(load(beforePath).map((item) => [key(item), item]));
const after = new Map(load(afterPath).map((item) => [key(item), item]));

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const num = (v) => (v === null ? "    -- " : v.toFixed(2).padStart(7));

const rows = [];

for (const [k, b] of before) {
  const a = after.get(k);
  rows.push({
    page: b.page,
    width: b.width,
    selector: b.selector,
    text: b.text,
    was: b.ragged,
    now: a ? a.ragged : null,
    wrapWas: b.textWrap,
    wrapNow: a ? a.textWrap : "(no longer wraps)",
    lastWas: b.lastLineWords,
    lastNow: a ? a.lastLineWords : null,
  });
}

for (const [k, a] of after) {
  if (!before.has(k)) {
    rows.push({
      page: a.page,
      width: a.width,
      selector: a.selector,
      text: a.text,
      was: null,
      now: a.ragged,
      wrapWas: "(did not wrap)",
      wrapNow: a.textWrap,
      lastWas: null,
      lastNow: a.lastLineWords,
    });
  }
}

const changed = rows.filter((r) => r.was === null || r.now === null || r.was !== r.now);

console.log(`${beforePath} -> ${afterPath}`);
console.log(`${rows.length} rows, ${changed.length} moved\n`);
console.log(
  ["page", "w", "selector", "text", "ragged was", "now", "delta", "last", "text-wrap now"]
    .map((h, i) => h.padEnd([8, 5, 30, 40, 11, 8, 9, 6, 16][i]))
    .join(""),
);

for (const r of changed) {
  const delta = r.was !== null && r.now !== null ? r.now - r.was : null;

  console.log(
    [
      r.page.padEnd(8),
      String(r.width).padEnd(5),
      clip(r.selector, 29).padEnd(30),
      clip(r.text, 39).padEnd(40),
      num(r.was).padEnd(11),
      num(r.now).padEnd(8),
      (delta === null ? "     --" : (delta > 0 ? "+" : "") + delta.toFixed(2)).padStart(8).padEnd(9),
      `${r.lastWas ?? "-"}->${r.lastNow ?? "-"}`.padEnd(6),
      r.wrapNow,
    ].join(""),
  );
}

const moved = changed.filter((r) => r.was !== null && r.now !== null);
const better = moved.filter((r) => r.now < r.was);
const worse = moved.filter((r) => r.now > r.was);
const sum = (list) => list.reduce((n, r) => n + (r.now - r.was), 0);

console.log(`\nbetter (less ragged): ${better.length}   total ${sum(better).toFixed(2)} px`);
console.log(`worse  (more ragged): ${worse.length}   total +${sum(worse).toFixed(2)} px`);

const strandedBefore = rows.filter((r) => r.lastWas === 1).length;
const strandedAfter = rows.filter((r) => r.lastNow === 1).length;

console.log(`blocks ending on one stranded word: ${strandedBefore} -> ${strandedAfter}`);

if (worse.length > 0) {
  console.log("\nWORSE -- each of these needs a reason or a revert:");
  worse.forEach((r) =>
    console.log(`  ${r.page} ${r.width}  ${r.selector}  ${clip(r.text, 50)}`),
  );
}
