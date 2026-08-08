"use client";

import { QueryLink } from "@/app/(site)/_listing/query-link";
import { withPage, type JobQuery } from "@/lib/search/job-query";
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
// tab, bookmarked, and reached without JavaScript. The current page is marked
// with aria-current rather than being removed, so its position is announced.
function PageLink({ page, query, label, current }: {
  page: number;
  query: JobQuery;
  label: string;
  current?: boolean;
}) {
  return (
    <li>
      <QueryLink className="pager__link" current={current} query={withPage(query, page)}>
        {label}
      </QueryLink>
    </li>
  );
}

// A disabled edge is a <span>, not a dead link: there is no URL for "before page
// one", and an anchor without an href is not focusable or announced as a link.
function PagerEdge({ label }: { label: string }) {
  return (
    <li>
      <span aria-disabled="true" className="pager__link pager__link--off">
        {label}
      </span>
    </li>
  );
}

export function Pagination({ query, window }: { query: JobQuery; window: PageWindow }) {
  if (window.pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="pager">
      <ul className="pager__list">
        {window.hasPrevious ? (
          <PageLink label="Previous" page={window.page - 1} query={query} />
        ) : (
          <PagerEdge label="Previous" />
        )}

        {pageNumbers(window.page, window.pageCount).map((page) => (
          <PageLink
            current={page === window.page}
            key={page}
            label={String(page)}
            page={page}
            query={query}
          />
        ))}

        {window.hasNext ? (
          <PageLink label="Next" page={window.page + 1} query={query} />
        ) : (
          <PagerEdge label="Next" />
        )}
      </ul>
    </nav>
  );
}
