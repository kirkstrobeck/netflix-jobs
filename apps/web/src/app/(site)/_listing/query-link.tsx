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
  /**
   * An id on this page to land on, appended to the href.
   *
   * The pager passes one, and it is the whole of "a new page starts at the top
   * of the list". See the click handler below for why a link with a fragment is
   * the one case that is NOT intercepted outright.
   */
  fragment?: string;
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
  fragment,
  children,
}: QueryLinkProps) {
  const navigate = useQueryNavigation();
  const follow = onFollow ?? navigate;
  const href = fragment ? `${jobsHref(query)}#${fragment}` : jobsHref(query);

  /**
   * WHY THE FRAGMENT CASE DOES NOT preventDefault
   *
   * A link with a fragment has two jobs: change the query, and put the target
   * on screen. The first is ours -- the board is in memory, so it costs a
   * pushState and no round trip. The second is the browser's, and the browser
   * will only do it for a real navigation.
   *
   * So the order is: push the new URL, fragment and all, then stand back. By
   * the time the default action runs, the document's URL is already exactly
   * what this anchor points at -- and navigating to the URL you are already on
   * is a fragment navigation that REPLACES rather than pushes. One history
   * entry, at the right address, and the scroll is the browser's own, honouring
   * scroll-margin like any other `#` link.
   *
   * Calling preventDefault here instead and then scrolling by hand is the
   * version that needs to know how tall the header is.
   */
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) {
      return;
    }

    if (fragment) {
      follow(query, fragment);
      return;
    }

    event.preventDefault();
    follow(query);
  };

  return (
    <a aria-current={current} className={className} href={href} onClick={click}>
      {children}
    </a>
  );
}
