import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderAsync } from "@/app/(site)/render-async";
import { WORDMARK_RED, Wordmark } from "@/app/(site)/wordmark";
import { EMPTY_QUERY, jobsHref } from "@/lib/search/job-query";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/parse-query";

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

// The href in the HTML that ships, as a URL. `&` between params is written
// `&amp;` in an attribute -- correct HTML, and the browser hands the unescaped
// URL to the network -- so it is unescaped here and the assertions below are
// about the address rather than about the encoding.
function markHref(html: string): string {
  const raw = html.match(/<a class="wordmark" href="([^"]*)"/)?.[1] ?? "";

  return raw.replaceAll("&amp;", "&");
}

async function renderFiltered(params: RawSearchParams): Promise<string> {
  return renderAsync(
    <Wordmark className="wordmark" loading="eager" searchParams={Promise.resolve(params)} />,
  );
}

// The mark goes home, and on the board home is the board they are already on.
// A bare "/" there is the worst answer available: it drops the filters, and `/`
// is then re-answered by proxy.ts with the country it reads off the request, so
// the visitor lands on a differently filtered board rather than an unfiltered
// one.
describe("the wordmark on a filtered board", () => {
  it("carries the active facets home", async () => {
    const html = await renderFiltered({
      country: "US",
      team: "Engineering",
      type: "Remote",
    });

    expect(markHref(html)).toBe("/?country=US&type=Remote&team=Engineering");
  });

  // Not "spelled the same way" -- spelled by the same function. A second
  // serializer that ordered the params differently would be a second URL for
  // one state, and two cache entries for one board.
  it("is spelled by the builder every facet link is spelled by", async () => {
    const params: RawSearchParams = {
      country: ["JP", "US"],
      site: "tokyo",
      unit: "Streaming",
      q: "data",
      sort: "near",
      page: "2",
    };
    const html = await renderFiltered(params);

    expect(markHref(html)).toBe(jobsHref(parseJobQuery(params)));
  });

  // Country is a facet like any other here. It reaches most URLs by IP
  // detection rather than by a tick, and carrying it is what stops the mark
  // from handing the visitor back to that detection.
  it("keeps a country that arrived from detection", async () => {
    const html = await renderFiltered({ country: "JP" });

    expect(markHref(html)).toBe("/?country=JP");
  });

  // Nothing in this file mocks next/navigation, so the board's mark renders
  // here with no router above it -- which is the server's own situation, and a
  // crawler's. useSearchParams answers null there and the href stays the one
  // the server spelled. Every assertion in this describe is therefore also the
  // assertion that following the URL on the client did not cost the server
  // render; wordmark-link.test.tsx is the other half.
  it("stays a bare / when the board has nothing applied", async () => {
    const html = await renderFiltered({});

    expect(markHref(html)).toBe("/");
    expect(html).not.toContain("/?");
  });

  // What the shell carries before the query lands, and what a visitor with no
  // JavaScript is left with: the same mark, at the same size, pointing at the
  // unfiltered board. Nothing moves when the real href arrives.
  it("falls back to the unfiltered board, not to a hole", () => {
    const html = renderToStaticMarkup(
      <Wordmark className="wordmark" loading="eager" searchParams={Promise.resolve({})} />,
    );

    expect(markHref(html)).toBe(jobsHref(EMPTY_QUERY));
    expect(html).toContain(WORDMARK_RED);
    expect(html).toContain(">Jobs</span>");
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
