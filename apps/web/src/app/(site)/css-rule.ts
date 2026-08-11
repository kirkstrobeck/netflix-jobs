import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reading the (site) stylesheets as text is the only way to assert them: the
// suite runs in jsdom with css: false, so there is no cascade to query and no
// layout engine to measure against. Shared rather than copied because three
// suites now do it -- job-shell, site-footer and site-header.

// Comments first. These files carry more prose than declarations, and every one
// of them mentions selectors and properties that would otherwise match.
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function readCss(name: string): string {
  return stripComments(
    readFileSync(join(process.cwd(), "src/app/(site)", name), "utf8"),
  );
}

// The body of the first block in `css`, braces balanced -- which the regex
// below cannot do, and a @keyframes block is two levels deep. The end index is
// carried rather than returned early, so there is no unreachable guard on the
// way out for a malformed sheet that this repo's generators cannot produce.
function balanced(css: string): string {
  const open = css.indexOf("{");
  let depth = 0;
  let end = css.length;

  for (let index = open; index < css.length; index += 1) {
    depth += Number(css[index] === "{") - Number(css[index] === "}");
    end = depth === 0 ? Math.min(end, index) : end;
  }

  return css.slice(open + 1, end);
}

/**
 * Every property any @keyframes block in a stylesheet animates, deduplicated.
 *
 * A scroll-driven animation is only free if what it animates is free, and the
 * difference between a compositor property and a layout one is invisible in the
 * markup, invisible in a screenshot, and easy to state wrongly in a comment
 * above the rule -- which is exactly how min-block-size stayed on this header's
 * scroll timeline. So the assertion reads the keyframes themselves.
 */
export function keyframeProperties(css: string): string[] {
  const properties = css
    .split(/@keyframes\b/)
    .slice(1)
    .flatMap((block) => [...balanced(block).matchAll(/([-\w]+)\s*:/g)])
    .map((declaration) => declaration[1]);

  return [...new Set(properties)];
}

// The declaration body of one rule, by exact selector, or "" if there is no such
// rule -- which fails the toContain that follows just as loudly as a wrong value.
export function rule(css: string, selector: string): string {
  const normalise = (value: string) => value.trim().replace(/\s+/g, " ");

  return (
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((match) => ({ selector: normalise(match[1]), body: match[2] }))
      .find((entry) => entry.selector === normalise(selector))?.body ?? ""
  );
}
