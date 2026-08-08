import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "@/app/(site)/_listing/pagination";
import { ResultCount } from "@/app/(site)/_listing/result-count";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { paginate } from "@/lib/search/paginate";

// The static render is the one a crawler and a JavaScript-off visitor get, so
// what is under test here is that every page is still a real href.
const markup = (total: number, page: number, query: JobQuery = EMPTY_QUERY) =>
  renderToStaticMarkup(
    <NavigateProvider value={vi.fn()}>
      <Pagination query={query} window={paginate(total, page)} />
    </NavigateProvider>,
  );

// renderToStaticMarkup escapes the & between query params, so the attribute
// text is not the URL until it is decoded.
const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]*)"/g)].map((match) =>
    match[1].replaceAll("&amp;", "&"),
  );

describe("Pagination", () => {
  // Nothing to paginate is not a control with one button in it.
  it("renders nothing when everything fits on one page", () => {
    expect(markup(10, 1)).toBe("");
    expect(markup(0, 1)).toBe("");
  });

  it("marks the current page and links every other one", () => {
    const html = markup(50, 3);

    expect(html).toContain('aria-current="page"');
    expect(hrefs(html)).toContain("/?page=2");
    expect(hrefs(html)).toContain("/?page=4");
  });

  // Page 1 is the bare URL, not ?page=1 -- the same page must not have two URLs.
  it("links back to page 1 without a page param", () => {
    expect(hrefs(markup(50, 2))).toContain("/");
  });

  // A dead <a href> is not focusable and is not announced as a link, so the
  // unavailable edge is a span instead.
  it("has no previous link on the first page", () => {
    const html = markup(50, 1);

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(">Previous</a>");
    expect(html).toContain(">Next</a>");
  });

  it("has no next link on the last page", () => {
    const html = markup(50, 5);

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(">Next</a>");
    expect(html).toContain(">Previous</a>");
  });

  it("builds its links from the clamped page, not the requested one", () => {
    // 24 results is 3 pages; page 99 clamps to 3, whose previous is 2.
    expect(hrefs(markup(24, 99))).toContain("/?page=2");
  });

  it("carries every active facet and keyword into each page link", () => {
    const query: JobQuery = {
      ...EMPTY_QUERY,
      team: ["Engineering"],
      workType: ["Remote"],
      keywords: ["design"],
    };

    expect(hrefs(markup(50, 2, query))).toContain(
      "/?team=Engineering&type=Remote&q=design&page=3",
    );
  });

  // 49 pages must not render 49 links.
  it("shows a fixed window of page numbers however long the list is", () => {
    const numbered = (html: string) =>
      [...html.matchAll(/>(\d+)<\/(?:a|span)>/g)].map((m) => Number(m[1]));

    expect(numbered(markup(481, 25))).toEqual([23, 24, 25, 26, 27]);
    expect(numbered(markup(481, 1))).toEqual([1, 2, 3, 4, 5]);
    expect(numbered(markup(481, 49))).toEqual([45, 46, 47, 48, 49]);
  });

  it("names the landmark so it is reachable as a navigation region", () => {
    expect(markup(50, 1)).toContain('aria-label="Pagination"');
  });
});

describe("ResultCount", () => {
  const count = (total: number, page: number) =>
    renderToStaticMarkup(<ResultCount window={paginate(total, page)} />);

  it("reports the window and the total", () => {
    expect(count(481, 1)).toContain("Showing <strong>1</strong> to <strong>10</strong>");
    expect(count(481, 1)).toContain("<strong>481</strong>");
  });

  it("reports a partial last page", () => {
    expect(count(24, 3)).toContain("<strong>21</strong> to <strong>24</strong>");
  });

  it("says so when nothing matched", () => {
    expect(count(0, 1)).toContain("No matching roles");
  });

  it("uses the singular for one result", () => {
    const html = count(1, 1);

    expect(html).toContain("role");
    expect(html).not.toContain("roles");
  });

  // Filtering happens without a page load, so the change needs announcing.
  it("is a polite live region", () => {
    expect(count(481, 1)).toContain('aria-live="polite"');
  });
});
