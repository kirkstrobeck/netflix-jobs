// Sweep for "word separation delegated to CSS": two adjacent text runs inside one
// element with no whitespace between them in the MARKUP, held apart only by a
// margin or a flex gap. Copying the text, an accessible name computed from it,
// or a stale stylesheet all collapse them back together.
import { chromium } from "playwright-core";

const URLS = process.argv.slice(2);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

const FIND = () => {
  const runs = (node) => {
    // The text each child contributes, in order, without collapsing anything.
    const parts = [];
    for (const child of node.childNodes) {
      if (child.nodeType === 3) parts.push({ text: child.nodeValue, el: null });
      if (child.nodeType === 1) {
        const style = getComputedStyle(child);
        if (style.display === "none") continue;
        parts.push({ text: child.textContent, el: child });
      }
    }
    return parts;
  };

  const hits = [];
  for (const node of document.querySelectorAll("*")) {
    // Whitespace-only runs are KEPT and merged into the run before them. They
    // are the separator being looked for, so dropping them is how this probe
    // reports a fix as still broken.
    const parts = [];
    for (const part of runs(node)) {
      const solid = part.text && part.text.trim();
      if (!solid && parts.length) {
        parts[parts.length - 1] = {
          ...parts[parts.length - 1],
          text: parts[parts.length - 1].text + part.text,
        };
        continue;
      }
      if (solid) parts.push(part);
    }
    if (parts.length < 2) continue;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const left = parts[i].text;
      const right = parts[i + 1].text;
      // Whitespace on either side of the boundary is separation that survives
      // everything. Its absence is the bug.
      if (/\s$/.test(left) || /^\s/.test(right)) continue;
      // Punctuation carries its own separation: ": Title", "(AIMS)".
      if (/[^\p{L}\p{N}]$/u.test(left.trim()) || /^[^\p{L}\p{N}]/u.test(right.trim())) continue;
      // A block-level boundary separates the runs on its own -- they land on
      // different lines and nothing is glued. Only runs sharing a line box are
      // relying on a margin or a gap to be two words.
      const el = parts[i + 1].el;
      const childDisplay = el ? getComputedStyle(el).display : "inline";
      const parentDisplay = getComputedStyle(node).display;
      const inlineish = /inline|contents/.test(childDisplay);
      const flexRow =
        /flex|grid/.test(parentDisplay) &&
        !/column/.test(getComputedStyle(node).flexDirection ?? "");
      if (!inlineish && !flexRow) continue;
      hits.push({
        parent: node.className || node.tagName,
        joined: (left.trim() + right.trim()).slice(0, 60),
        childClass: el?.className ?? "(text)",
        how: flexRow ? `gap:${getComputedStyle(node).gap}` : "margin/inline",
      });
    }
  }
  return hits;
};

for (const url of URLS) {
  for (const width of [1280, 900]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle" });
    const hits = await page.evaluate(FIND);
    console.log(`\n=== ${width}px ${url}`);
    if (!hits.length) console.log("  (none)");
    for (const h of hits)
      console.log(`  .${h.parent} > .${h.childClass} [${h.how}]: "${h.joined}"`);
    await page.close();
  }
}

await browser.close();
