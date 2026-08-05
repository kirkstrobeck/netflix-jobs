const HREF_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|\/|#)/i;
// Built from a string literal so no raw control bytes land in this source file.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0020]", "g");

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

// Entities are decoded before the scheme is checked so that an encoded
// "&#106;avascript:" cannot slip past SAFE_HREF.
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    const lower = body.toLowerCase();

    if (lower.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(2), 16) || 0);
    }

    if (lower.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10) || 0);
    }

    return NAMED_ENTITIES[lower] ?? match;
  });
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeHref(raw: string): string | null {
  // Control characters and whitespace are stripped first: browsers ignore them
  // when resolving a scheme, so a newline inside "java script:" would survive.
  const candidate = decodeEntities(raw).replace(CONTROL_CHARS, "");

  return SAFE_HREF.test(candidate) ? candidate : null;
}

// Every other attribute is discarded, which is what removes the 2431 inline
// `style` attributes and the 211 `class` attributes that would otherwise fight
// the page's own typography.
export function renderAttributes(tag: string, raw: string): string {
  if (tag !== "a") {
    return "";
  }

  const match = HREF_PATTERN.exec(raw);
  const href = safeHref(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");

  if (!href) {
    return "";
  }

  return ` href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer nofollow"`;
}
