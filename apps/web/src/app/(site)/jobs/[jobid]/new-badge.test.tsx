import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NewBadge } from "@/app/(site)/jobs/[jobid]/new-badge";

// The badge is one span; everything that makes it a badge is in the stylesheet.
const css = readFileSync(
  join(process.cwd(), "src/app/(site)/jobs/[jobid]/posted-badge.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

describe("NewBadge", () => {
  it("writes the word in sentence case and leaves the casing to CSS", () => {
    const html = renderToStaticMarkup(<NewBadge />);

    expect(html).toContain(">New<");
    expect(html).not.toContain("NEW");
  });

  it("carries the class the badge is styled through", () => {
    expect(renderToStaticMarkup(<NewBadge />)).toContain('class="posted-badge"');
  });

  it("is a filled badge, not tinted text", () => {
    const rule = css.match(/\.posted-badge\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toContain("background: var(--accent)");
    expect(rule).toContain("color: #fff");
    expect(rule).toContain("border-radius");
  });

  // The old treatment borrowed .job-facts__item's 3px separator dot, which read
  // as another break in the fact row rather than as part of the posted phrase.
  it("draws no separator dot", () => {
    expect(css).not.toContain(".posted-badge::before");
  });
});
