"use client";

import type { MouseEvent, ReactNode } from "react";

import { useQueryNavigation } from "@/app/(site)/_listing/use-query-navigation";
import { jobsHref, type JobQuery } from "@/lib/search/job-query";

type QueryLinkProps = {
  query: JobQuery;
  className?: string;
  /**
   * Which kind of "this is the one you are on" to announce, if any.
   *
   * "page" is for a link that IS a page -- the pager's current number. "true"
   * is for one item of a set that is not a page, which is what a sort option
   * is. They are different words in ARIA and the difference is audible, so the
   * caller says which rather than having one picked for it.
   */
  current?: "page" | "true";
  /**
   * What a plain click does, when the default navigate is not the whole of it.
   *
   * The country links pass useCountryChoice, which navigates AND remembers.
   * Same href either way -- this only replaces the intercepted click, so the
   * JavaScript-off path is untouched.
   */
  onFollow?: (query: JobQuery) => void;
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
export function QueryLink({
  query,
  className,
  current,
  onFollow,
  children,
}: QueryLinkProps) {
  const navigate = useQueryNavigation();
  const follow = onFollow ?? navigate;

  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) {
      return;
    }

    event.preventDefault();
    follow(query);
  };

  return (
    <a
      aria-current={current}
      className={className}
      href={jobsHref(query)}
      onClick={click}
    >
      {children}
    </a>
  );
}
