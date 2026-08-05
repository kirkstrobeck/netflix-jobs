// The crawled descriptions use a small, well-known set of tags. Counted across all
// 481 rows: p, span, li, b, ul, u, a, h2, br, i, h1, h3, div.
export const ALLOWED_TAGS = new Set([
  "p",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "br",
  "hr",
  "blockquote",
]);

// Dropped along with their contents. None of these appear in the data today; they
// are here so a future crawl cannot inject script or styling into the page.
export const DROPPED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "form",
  "input",
  "select",
  "textarea",
  "button",
  "link",
  "meta",
  "title",
  "base",
]);

// The page owns the only <h1>, and 125 descriptions carry an <h1> of their own.
// Demoting every source heading keeps one h1 per document and a gapless order:
// page h1 > section h2 > description h3 > h4.
export const HEADING_MAP: Record<string, string> = {
  h1: "h3",
  h2: "h3",
  h3: "h4",
  h4: "h5",
  h5: "h6",
  h6: "h6",
};

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source"]);

export function isVoidTag(name: string): boolean {
  return VOID_TAGS.has(name);
}

// Anything not allowed, not dropped and not a heading is unwrapped: the tag
// disappears but its text survives. That is what happens to <div> and <font>.
export function mapTag(name: string): string | null {
  const heading = HEADING_MAP[name];

  if (heading) {
    return heading;
  }

  return ALLOWED_TAGS.has(name) ? name : null;
}
