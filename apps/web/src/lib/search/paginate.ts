export const PAGE_SIZE = 10;

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
