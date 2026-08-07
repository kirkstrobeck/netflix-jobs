import { renderAttributes } from "@/lib/html/attributes";
import { DROPPED_TAGS, isVoidTag, mapTag } from "@/lib/html/policy";

// Matches a comment, or a tag whose attribute soup may contain quoted ">".
const TOKEN =
  /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;

type Frame = { source: string; output: string | null };

function escapeText(value: string): string {
  return value.replace(/</g, "&lt;");
}

function indexOfOpenTag(stack: Frame[], name: string): number {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].source === name) {
      return i;
    }
  }

  return -1;
}

// Closes every frame from `depth` upwards, innermost first. Unwrapped tags hold
// a null output, so they leave the stack without emitting anything.
function unwind(out: string[], stack: Frame[], depth: number): void {
  stack
    .splice(depth)
    .reverse()
    .forEach((frame) => {
      if (frame.output) {
        out.push(`</${frame.output}>`);
      }
    });
}

// Unwinds to the matching open tag, closing anything left dangling inside it. A
// stray "</b>" with no opener is ignored rather than emitted.
function closeTag(out: string[], stack: Frame[], name: string): void {
  const index = indexOfOpenTag(stack, name);

  if (index < 0) {
    return;
  }

  unwind(out, stack, index);
}

function openTag(out: string[], stack: Frame[], name: string, attrs: string): void {
  const output = mapTag(name);
  stack.push({ source: name, output });

  if (!output) {
    return;
  }

  out.push(`<${output}${renderAttributes(output, attrs)}>`);
}

/**
 * Allowlist sanitizer for the crawled `description_html`.
 *
 * Rebuilds the markup from scratch rather than patching the input: a tag only
 * reaches the output if policy.ts names it, and the only attribute that survives
 * is a scheme-checked href. Unknown tags are unwrapped so their text is kept,
 * and DROPPED_TAGS take their contents with them.
 */
export function sanitizeHtml(input: string): string {
  const out: string[] = [];
  const stack: Frame[] = [];
  let dropDepth = 0;
  let dropTag = "";
  let cursor = 0;

  TOKEN.lastIndex = 0;

  for (let match = TOKEN.exec(input); match; match = TOKEN.exec(input)) {
    const text = input.slice(cursor, match.index);
    cursor = TOKEN.lastIndex;

    if (dropDepth === 0 && text) {
      out.push(escapeText(text));
    }

    // A comment matches the first branch, leaving the capture groups undefined.
    if (match[2] === undefined) {
      continue;
    }

    const closing = match[1] === "/";
    const name = match[2].toLowerCase();

    if (dropDepth > 0) {
      if (name === dropTag) {
        dropDepth += closing ? -1 : 1;
      }

      continue;
    }

    if (DROPPED_TAGS.has(name)) {
      if (!closing) {
        dropDepth = 1;
        dropTag = name;
      }

      continue;
    }

    if (isVoidTag(name)) {
      if (!closing && mapTag(name)) {
        out.push(`<${name}>`);
      }

      continue;
    }

    if (closing) {
      closeTag(out, stack, name);
      continue;
    }

    // The attribute group always participates in the match, so it is never
    // undefined — an attribute-less tag simply captures "".
    openTag(out, stack, name, match[3]);
  }

  if (dropDepth === 0) {
    out.push(escapeText(input.slice(cursor)));
  }

  unwind(out, stack, 0);

  return out.join("");
}
