/**
 * Rows per page.
 *
 * 20, not 10, because a row is now one title on one line rather than a title
 * over a four-column block of facts. Ten of the old rows and twenty of these
 * take about the same vertical space, so the page did not get longer -- it got
 * twice as much of what anyone actually scans. 481 postings is 25 pages.
 *
 * Paging is resolved in the browser from the board that is already in memory,
 * so a bigger page costs no extra request and no extra SSR variant: the server
 * renders one page for the first paint and nothing after it.
 */
export const PAGE_SIZE = 20;

export type PageWindow = {
  /** The page actually shown, clamped into range. */
  page: number;
  pageCount: number;
  /** 1-indexed positions for "showing X to Y of N". Both 0 when N is 0. */
  from: number;
  to: number;
  total: number;
  offset: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/**
 * Where one page sits in a result set.
 *
 * The requested page is clamped rather than 404'd: a filter change can shrink
 * the results under a page number that was valid a moment ago, and showing the
 * last page beats showing an error. pageCount is at least 1, so an empty result
 * set is "page 1 of 1" rather than "page 1 of 0".
 */
export function paginate(total: number, requested: number): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(requested)), pageCount);
  const offset = (page - 1) * PAGE_SIZE;

  return {
    page,
    pageCount,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + PAGE_SIZE, total),
    total,
    offset,
    hasPrevious: page > 1,
    hasNext: page < pageCount,
  };
}

export function pageSlice<T>(items: T[], window: PageWindow): T[] {
  return items.slice(window.offset, window.offset + PAGE_SIZE);
}
