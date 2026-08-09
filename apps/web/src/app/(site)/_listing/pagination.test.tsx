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

// Every page link ends in the heading it lands on, which is not part of the
// query and is the same on all of them. The tests below are about the query, so
// they compare addresses without it.
const queries = (html: string) =>
  hrefs(html).map((href) => href.split("#")[0]);

describe("Pagination", () => {
  // Nothing to paginate is not a control with one button in it.
  it("renders nothing when everything fits on one page", () => {
    expect(markup(20, 1)).toBe("");
    expect(markup(0, 1)).toBe("");
  });

  it("marks the current page and links every other one", () => {
    const html = markup(100, 3);

    expect(html).toContain('aria-current="page"');
    expect(queries(html)).toContain("/?page=2");
    expect(queries(html)).toContain("/?page=4");
  });

  // Page 1 is the bare URL, not ?page=1 -- the same page must not have two URLs.
  it("links back to page 1 without a page param", () => {
    expect(queries(markup(100, 2))).toContain("/");
  });

  /**
   * There is no control, rather than a control that refuses.
   *
   * A greyed-out Previous on page one is a button whose whole job is to be
   * pressed and do nothing, and the <span aria-disabled> it used to be said the
   * same thing to a screen reader. Neither is rendered now: the word does not
   * appear in the markup at all.
   */
  it("has no previous control at all on the first page", () => {
    const html = markup(100, 1);

    expect(html).not.toContain("Previous");
    expect(html).not.toContain("aria-disabled");
    expect(html).toContain(">Next</a>");
  });

  it("has no next control at all on the last page", () => {
    const html = markup(100, 5);

    expect(html).not.toContain("Next");
    expect(html).not.toContain("aria-disabled");
    expect(html).toContain(">Previous</a>");
  });

  // The page you are on is announced by aria-current and is not a link: an href
  // pointing at the address you are already at has nothing to do.
  it("does not link the page it is on", () => {
    const html = markup(100, 3);

    expect(html).toContain('<span aria-current="page"');
    expect(queries(html)).not.toContain("/?page=3");
  });

  // Changing page swaps the rows under the "Open roles" heading, so that is
  // where it lands -- the browser's own fragment jump, no scroll script.
  it("ends every page link at the results heading", () => {
    const links = hrefs(markup(100, 3));

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((href) => href.endsWith("#open-roles"))).toBe(true);
  });

  it("builds its links from the clamped page, not the requested one", () => {
    // 44 results is 3 pages; page 99 clamps to 3, whose previous is 2.
    expect(queries(markup(44, 99))).toContain("/?page=2");
  });

  // The country included. Paging is the one control that is worked repeatedly,
  // and a page link that dropped it would widen the listing back to the world
  // on the visitor's second click.
  it("carries every active facet and keyword into each page link", () => {
    const query: JobQuery = {
      ...EMPTY_QUERY,
      country: ["US"],
      site: ["us-los-gatos"],
      team: ["Engineering"],
      workType: ["Remote"],
      keywords: ["design"],
    };

    expect(queries(markup(100, 2, query))).toContain(
      "/?country=US&site=us-los-gatos&type=Remote&team=Engineering&q=design&page=3",
    );
  });

  // Everywhere is spelled by leaving the param off, so page 3 of an unfiltered
  // listing is `?page=3` and nothing else. The word `all` is gone from the
  // vocabulary and no link may reintroduce it.
  it("never writes a country into an unfiltered page link", () => {
    const links = queries(markup(100, 2, EMPTY_QUERY));

    expect(links).toContain("/?page=3");
    expect(links.join(" ")).not.toContain("country=");
  });

  // 25 pages must not render 25 links.
  it("shows a fixed window of page numbers however long the list is", () => {
    const numbered = (html: string) =>
      [...html.matchAll(/>(\d+)<\/(?:a|span)>/g)].map((m) => Number(m[1]));

    expect(numbered(markup(481, 13))).toEqual([11, 12, 13, 14, 15]);
    expect(numbered(markup(481, 1))).toEqual([1, 2, 3, 4, 5]);
    expect(numbered(markup(481, 25))).toEqual([21, 22, 23, 24, 25]);
  });

  it("names the landmark so it is reachable as a navigation region", () => {
    expect(markup(100, 1)).toContain('aria-label="Pagination"');
  });
});

describe("ResultCount", () => {
  const count = (total: number, page: number) =>
    renderToStaticMarkup(<ResultCount window={paginate(total, page)} />);

  it("reports the window and the total", () => {
    expect(count(481, 1)).toContain("Showing 1 thru 20 of 481 roles");
  });

  it("reports a partial last page", () => {
    expect(count(44, 3)).toContain("41 thru 44");
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
