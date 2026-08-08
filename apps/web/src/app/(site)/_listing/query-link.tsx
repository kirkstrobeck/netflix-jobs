"use client";

import type { MouseEvent, ReactNode } from "react";

import { useQueryNavigation } from "@/app/(site)/_listing/use-query-navigation";
import { jobsHref, type JobQuery } from "@/lib/search/job-query";

type QueryLinkProps = {
  query: JobQuery;
  className?: string;
  current?: boolean;
  children: ReactNode;
};

// A modified click is the visitor asking the BROWSER to do something -- open in
// a new tab, in a new window, download it -- and the href is a real page, so it
// is left alone. Only a plain left click is ours to intercept.
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * A real anchor with a real href that filters without leaving the page.
 *
 * Deliberately not next/link. Link prefetches, and a pager of 49 pages that are
 * all computed on the client would prefetch 49 documents nobody will ever be
 * served. The href is still the server-rendered URL, so the link is crawlable,
 * bookmarkable, middle-clickable, and works with JavaScript off; the handler is
 * only what stops the round trip when JavaScript is there.
 */
export function QueryLink({ query, className, current, children }: QueryLinkProps) {
  const navigate = useQueryNavigation();

  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) {
      return;
    }

    event.preventDefault();
    navigate(query);
  };

  return (
    <a
      aria-current={current ? "page" : undefined}
      className={className}
      href={jobsHref(query)}
      onClick={click}
    >
      {children}
    </a>
  );
}
