// Headings in the sanitized output are non-nesting and well formed, because the
// sanitizer rebuilds them. So one pair-matching pass is enough.
const HEADING = /<h([1-6])>([\s\S]*?)<\/h\1>/g;

const DEEPEST = 6;

function textOf(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
}

// The source levels that survive, shallowest first. Only headings with text
// count: an empty one is about to be deleted and must not reserve a level for
// itself, or removing it would open the very gap this is closing.
function levelsPresent(html: string): number[] {
  const levels = new Set<number>();

  HEADING.lastIndex = 0;
  for (let m = HEADING.exec(html); m; m = HEADING.exec(html)) {
    if (textOf(m[2])) {
      levels.add(Number(m[1]));
    }
  }

  return [...levels].sort((a, b) => a - b);
}

// Source level -> the level it will be rendered at: contiguous from `base`, in
// the source's own order of depth.
//
// Clamped at h6, which is the one case where the result can repeat a level. Six
// is as deep as HTML goes, so a description nesting five levels below our h2 has
// nowhere left to go -- and a repeat is a heading that reads as a sibling rather
// than a child, which is wrong but not a skip. axe fails the skip, not the
// repeat, and so does a screen reader user trying to find their place.
function levelMap(html: string, base: number): Map<number, number> {
  const present = levelsPresent(html);

  return new Map(
    present.map((level, index) => [level, Math.min(base + index, DEEPEST)]),
  );
}

/**
 * Fit a fragment's headings into the outline of the page embedding it.
 *
 * The crawled descriptions each carry their own document outline, and no two
 * agree on where it starts: some open at h1, most at h2 or h3. Dropping that
 * fragment under our own h2 with its levels untouched -- or shifted by a fixed
 * amount, which is the same bug with extra steps -- produces h1 > h2 > h4 the
 * moment a description happens to start at h3. That is what axe's heading-order
 * reports, and what a screen reader announces as a missing level.
 *
 * So the levels are renumbered rather than shifted. Whatever the shallowest
 * heading in the fragment is becomes `base`, the next distinct one becomes
 * base + 1, and so on: relative depth is preserved exactly, absolute depth is
 * ours to choose, and there is no gap by construction.
 *
 * Empty headings go entirely. 2 of the 481 descriptions use `<h3></h3>` as a
 * spacer, which renders as nothing and announces as an unlabelled heading --
 * noise in every heading list an assistive-tech user navigates by.
 */
export function fitHeadingOutline(html: string, base: number): string {
  const map = levelMap(html, base);

  return html.replace(HEADING, (_match, level: string, inner: string) => {
    const text = textOf(inner);

    if (!text) {
      return "";
    }

    const fitted = map.get(Number(level)) ?? base;

    return `<h${fitted}>${inner}</h${fitted}>`;
  });
}
