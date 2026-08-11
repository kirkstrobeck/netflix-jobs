// The in-page half of wrap.mjs: find every element whose text ACTUALLY wraps,
// and measure its line boxes.
//
// Exported as a plain function with no free variables, because playwright
// serialises the source and evaluates it in the page -- nothing it closes over
// travels with it, so everything it needs is defined inside.
//
// WHY LINE BOXES AND NOT THE ELEMENT BOX
//
// The element box is one rectangle spanning every line and says nothing about
// any of them: a three-line paragraph and a one-line paragraph in the same
// column have the same width. A Range over the element's contents reports one
// client rect per line box, which is the only thing that answers "how ragged".
//
// WHICH ELEMENTS COUNT
//
// The innermost block container of a text run, and nothing above it. An
// ancestor would report its descendants' lines as its own, so /about's <body>
// would come back as a 300-line "wrapping element". The test is that no
// descendant is block-level -- that makes the element the thing a line box
// actually belongs to.
//
// The visually-hidden runs are skipped. Each is clipped rather than removed, so
// it still has a 1px box wherever the clip put it, and ranging over it reports a
// line that is not on screen.

/** Runs in the page. Returns one record per element whose text wraps. */
export function collectWraps() {
  const BLOCK = /^(block|flow-root|flex|grid|list-item|table|table-row|table-cell)/;

  const isBlockish = (el) => BLOCK.test(getComputedStyle(el).display);

  // A readable, stable-enough address: tag plus its classes, walked up until the
  // path is unique in the document. Not for querySelector round-tripping -- for
  // a human reading a table and knowing which rule to edit.
  const describe = (el) => {
    const parts = [];

    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const classes = [...node.classList].filter((c) => !c.startsWith("__"));
      parts.unshift(node.tagName.toLowerCase() + classes.map((c) => "." + c).join(""));

      if (classes.length > 0) {
        break;
      }
    }

    return parts.join(" > ");
  };

  // One rect per line box. Grouped on rounded top rather than taken as-is,
  // because a line broken across inline elements -- a link mid-sentence -- gives
  // one rect per fragment, all sharing a top.
  const lineBoxes = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rects = [];

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement.closest(".visually-hidden")) {
        continue;
      }

      if (node.textContent.trim() === "") {
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(node);
      rects.push(...range.getClientRects());
    }

    const rows = new Map();

    for (const rect of rects) {
      if (rect.width === 0) {
        continue;
      }

      const key = Math.round(rect.top);
      const row = rows.get(key) ?? { left: Infinity, right: -Infinity };
      rows.set(key, {
        left: Math.min(row.left, rect.left),
        right: Math.max(row.right, rect.right),
      });
    }

    return [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([top, row]) => ({ top, width: Math.round((row.right - row.left) * 100) / 100 }));
  };

  // Population standard deviation of the line widths, in px.
  //
  // Over EVERY line including the last. That is the definition `balance` is
  // trying to minimise -- it equalises all lines -- so scoring it any other way
  // would not measure the thing being changed. It does mean a well-set paragraph
  // of running copy scores badly by construction, since its last line is short
  // on purpose; that is why the decision below is per element and not a global
  // sweep. min and max travel alongside so a big number can be read.
  const raggedness = (widths) => {
    const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
    const variance = widths.reduce((a, w) => a + (w - mean) ** 2, 0) / widths.length;

    return Math.round(Math.sqrt(variance) * 100) / 100;
  };

  // How many words sit on the final line box.
  //
  // Ranged per word rather than divided out of the text, because where a word
  // lands is the engine's decision and the string cannot be asked. A word is
  // assigned to the line whose top its own rect matches.
  const lastLineWordCount = (el, lines) => {
    const lastTop = lines[lines.length - 1].top;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let count = 0;

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement.closest(".visually-hidden")) {
        continue;
      }

      for (const match of node.textContent.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);

        const rect = range.getBoundingClientRect();

        if (rect.width > 0 && Math.round(rect.top) === lastTop) {
          count += 1;
        }
      }
    }

    return count;
  };

  const out = [];

  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest(".visually-hidden")) {
      continue;
    }

    if ([...el.children].some(isBlockish)) {
      continue;
    }

    if (!isBlockish(el)) {
      continue;
    }

    const text = (el.innerText ?? "").replace(/\s+/g, " ").trim();

    if (text === "") {
      continue;
    }

    const lines = lineBoxes(el);

    if (lines.length < 2) {
      continue;
    }

    const widths = lines.map((line) => line.width);
    const style = getComputedStyle(el);

    out.push({
      selector: describe(el),
      text,
      lines: lines.length,
      widths,
      ragged: raggedness(widths),
      min: Math.min(...widths),
      max: Math.max(...widths),
      // The /about claim, as a number. `pretty` is a LAST-LINE rule: what it
      // buys is that a block does not finish with one word alone on a line of
      // its own. Counting the words on the final line is therefore the direct
      // test of the sentence, and 1 is the failure this is all about.
      lastLineWords: lastLineWordCount(el, lines),
      textWrap: style.textWrap || `${style.textWrapMode} ${style.textWrapStyle}`,
    });
  }

  return out;
}
