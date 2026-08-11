// Regenerate the subset webfaces under apps/web/public/fonts.
//
// The shipped Netflix Sans faces carry 1014-1152 codepoints each: Greek,
// Cyrillic, Latin Extended-B and Latin Extended Additional among them. This
// board renders English job listings. Measured against every string it can put
// on a page -- all 480 postings' titles, teams, locations and description text,
// plus the three rendered pages -- the content uses 685 distinct codepoints, of
// which these faces can draw 108; the remaining 577 are CJK that the browser
// falls back for whether or not the file carries them.
//
// So the kept range below is not "what the content uses" -- that would rot the
// first time a posting arrives from Warsaw. It is a deliberate SUPERSET: the
// whole of Basic Latin, Latin-1 Supplement and Latin Extended-A, which covers
// every accented Latin alphabet Netflix hires into, plus the punctuation the
// descriptions actually contain. 379 codepoints, 181928 -> 69448 bytes.
//
// Not a build step. The four source faces have not changed since they were
// committed and a font subsetter is not a dependency this app should carry to
// serve a request; run it by hand when a face is replaced, and commit the
// output beside its source.
//
//   npm i subset-font          # not a repo dependency; install it where you run this
//   node tools/fonts/subset.mjs
//
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);

// Inclusive codepoint ranges, in the order a reader would want to check them.
const KEEP = [
  [0x0020, 0x007e, "Basic Latin, printable"],
  [0x00a0, 0x00ff, "Latin-1 Supplement"],
  [0x0100, 0x017f, "Latin Extended-A"],
  [0x2000, 0x206f, "General Punctuation"],
  [0x20ac, 0x20ac, "euro sign"],
  [0x2122, 0x2122, "trade mark sign"],
  [0x2153, 0x2153, "vulgar fraction one third"],
  [0x2190, 0x2193, "arrows"],
];

// source -> subset. The source names keep the content hash they arrived with;
// the subset names do not, because next/font fingerprints what it emits and the
// one file referenced by a hand-written @font-face is under an immutable
// Cache-Control from cache-headers.ts.
const FACES = [
  ["NetflixSans_W_Rg.013xgptcmkvot.woff2", "NetflixSans_W_Rg.subset.woff2"],
  ["NetflixSans_W_Md.9d31b8ed.woff2", "NetflixSans_W_Md.subset.woff2"],
  ["NetflixSans_W_Bd.437347b6.woff2", "NetflixSans_W_Bd.subset.woff2"],
  ["NetflixSans_W_UCdBd.c6a7edc6.woff2", "NetflixSans_W_UCdBd.subset.woff2"],
];

const DIR = new URL("../../apps/web/public/fonts/", import.meta.url).pathname;

function wantedText() {
  let text = "";

  for (const [lo, hi] of KEEP) {
    for (let cp = lo; cp <= hi; cp += 1) {
      text += String.fromCodePoint(cp);
    }
  }

  return text;
}

async function main() {
  const subsetFont = require("subset-font");
  const text = wantedText();
  let before = 0;
  let after = 0;

  for (const [source, target] of FACES) {
    const input = readFileSync(DIR + source);
    // subset-font drops requested codepoints the face does not have, so passing
    // the whole wanted range is safe and keeps this list free of per-face notes.
    const output = await subsetFont(input, text, { targetFormat: "woff2" });

    writeFileSync(DIR + target, output);
    before += input.length;
    after += output.length;
    console.log(`${source} -> ${target}  ${input.length} -> ${output.length}`);
  }

  console.log(`total ${before} -> ${after} (${before - after} bytes saved)`);
}

await main();
