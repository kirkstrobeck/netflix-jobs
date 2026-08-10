"use client";

import { QueryLink } from "@/app/(site)/_listing/query-link";
import { RESULTS_ANCHOR } from "@/app/(site)/_listing/results-anchor";
import { type JobQuery } from "@/lib/search/job-query";
import { withPage } from "@/lib/search/query-edits";
import type { PageWindow } from "@/lib/search/paginate";

// A window of page numbers around the current one, so 49 pages do not render 49
// links. Always PAGE_SPAN wide where there is room, so the control does not
// change width as it walks along.
const PAGE_SPAN = 5;

function pageNumbers(page: number, pageCount: number): number[] {
  const half = Math.floor(PAGE_SPAN / 2);
  const start = Math.max(1, Math.min(page - half, pageCount - PAGE_SPAN + 1));
  const end = Math.min(pageCount, start + PAGE_SPAN - 1);

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Real anchors, not buttons: every page is a URL, so it can be opened in a new
// tab, bookmarked, and reached without JavaScript.
//
// Every one of them ends in `#open-roles`. Changing page is not "go to a
// different document", it is "swap the twenty rows below that heading", so the
// heading is where it lands -- not the masthead, which the visitor has already
// read, and not wherever the pager happened to be, which is the bottom of a
// list that no longer exists.
function PageLink({ page, query, label, className }: {
  page: number;
  query: JobQuery;
  label: string;
  className: string;
}) {
  return (
    <QueryLink
      className={className}
      fragment={RESULTS_ANCHOR}
      query={withPage(query, page)}
    >
      {label}
    </QueryLink>
  );
}

/**
 * NOTHING HERE IS A CONTROL THAT DOES NOTHING.
 *
 * Previous is not rendered on page one and Next is not rendered on the last
 * page -- not greyed out, not present-but-disabled, not in the accessibility
 * tree at all. A greyed-out Previous on page one is a button whose entire job
 * is to be pressed and refuse, and a <span aria-disabled> version of it is the
 * same thing said to a screen reader as well.
 *
 * The current page number is not a link either, for the same reason: an href
 * pointing at the page you are already on is a control with nothing to do. It
 * keeps aria-current="page" as a <span>, so its position is still announced,
 * and it stops being a tab stop.
 *
 * WHY THE ROW STILL DOES NOT MOVE
 *
 * Three grid tracks, and each control is placed in one by name: Previous in the
 * first, the numbers in the second, Next in the third. An absent control leaves
 * its track standing and empty, so walking from page one to page two brings
 * Previous in without pushing Next across the row, and reaching the last page
 * drops Next without dragging the numbers after it. Reserving the space in CSS
 * is what makes it safe to not render the control at all -- the alternative is
 * rendering a dead one to hold a gap open, which is the bug.
 */
export function Pagination({ query, window }: { query: JobQuery; window: PageWindow }) {
  if (window.pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="pager">
      {window.hasPrevious ? (
        <PageLink
          className="pager__link pager__step pager__step--prev"
          label="Previous"
          page={window.page - 1}
          query={query}
        />
      ) : null}

      <ul className="pager__pages">
        {pageNumbers(window.page, window.pageCount).map((page) => (
          <li key={page}>
            {page === window.page ? (
              <span aria-current="page" className="pager__link pager__current">
                {page}
              </span>
            ) : (
              <PageLink
                className="pager__link"
                label={String(page)}
                page={page}
                query={query}
              />
            )}
          </li>
        ))}
      </ul>

      {window.hasNext ? (
        <PageLink
          className="pager__link pager__step pager__step--next"
          label="Next"
          page={window.page + 1}
          query={query}
        />
      ) : null}
    </nav>
  );
}
