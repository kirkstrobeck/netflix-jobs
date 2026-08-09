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
