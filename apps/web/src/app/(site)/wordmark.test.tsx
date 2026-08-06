import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORDMARK_RED, Wordmark } from "@/app/(site)/wordmark";

function readAsset(publicPath: string): string {
  return readFileSync(join(process.cwd(), "public", publicPath), "utf8");
}

// Every point in the path, which is all straight lines -- the EPS flattened its
// curves, so M/L pairs are the complete geometry.
function pathPoints(svg: string): Array<[number, number]> {
  const d = svg.match(/ d="([^"]*)"/)?.[1] ?? "";

  return [...d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
}

describe("Wordmark", () => {
  it("wraps the mark in a home link with the caller's class", () => {
    const html = renderToStaticMarkup(<Wordmark className="wordmark" loading="eager" />);

    expect(html).toContain('class="wordmark"');
    expect(html).toContain('href="/"');
  });

  // An image link with no accessible name is a real a11y failure, so the alt
  // and the sibling text together have to read "Netflix Jobs".
  it("names the link Netflix Jobs without duplicating text", () => {
    const html = renderToStaticMarkup(<Wordmark className="wordmark" loading="eager" />);

    expect(html).toContain('alt="Netflix"');
    expect(html).toContain('<span class="wordmark__suffix">Jobs</span>');
    expect(html).not.toContain("aria-label");
  });

  it("declares the intrinsic box so the browser reserves the space", () => {
    const html = renderToStaticMarkup(<Wordmark className="wordmark" loading="eager" />);

    expect(html).toContain('width="1427"');
    expect(html).toContain('height="383"');
  });

  it.each(["eager", "lazy"] as const)("passes loading=%s through", (loading) => {
    const html = renderToStaticMarkup(
      <Wordmark className="job-footer__wordmark" loading={loading} />,
    );

    expect(html).toContain(`loading="${loading}"`);
    expect(html).toContain(WORDMARK_RED);
  });
});

describe("the wordmark asset", () => {
  // The masthead and the footer load the SAME file. If a second tone ever comes
  // back, this is the test that has to be argued with first.
  it("is the only mark in public/logo", () => {
    const svg = readAsset(WORDMARK_RED);

    expect(svg).toContain('fill="#e50914"');
    expect(svg).not.toContain("#f5f5f5");
  });

  // The three things that would each draw a box around the glyph.
  it("carries no background rect, group or style element", () => {
    const svg = readAsset(WORDMARK_RED);

    expect(svg).not.toMatch(/<(rect|style|g|defs|clipPath|mask)\b/);
    expect(svg.match(/<path\b/g)).toHaveLength(1);
  });

  it("has a viewBox tight to the glyph, with no dead padding", () => {
    const svg = readAsset(WORDMARK_RED);
    const points = pathPoints(svg);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);

    expect(svg).toContain('viewBox="0 0 1427 383.396"');
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(1427);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(383.396);
  });
});
