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
  // Headings pass through at their source level. Fitting them into the page's
  // outline is fitHeadingOutline's job, and it has to see the levels the source
  // actually used to do it -- see heading-outline.ts. Nothing renders a
  // sanitized description without that pass.
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
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

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source"]);

export function isVoidTag(name: string): boolean {
  return VOID_TAGS.has(name);
}

// Anything not allowed and not dropped is unwrapped: the tag disappears but its
// text survives. That is what happens to <div> and <font>.
export function mapTag(name: string): string | null {
  return ALLOWED_TAGS.has(name) ? name : null;
}
