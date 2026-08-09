"use client";

import Link from "next/link";
import { useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { jobsHref } from "@/lib/search/job-query";
import { readSearchParams } from "@/lib/search/parse-query";

type BoardLinkProps = {
  className: string;
  /**
   * The href the server rendered, which is what this ships with and what a
   * visitor with no JavaScript is left holding. It is the value below only
   * until there is a URL to read -- see boardHref.
   */
  href: string;
  children: ReactNode;
};

/**
 * The URL, read the same way the listing reads it.
 *
 * `null` is the documented return when there is no router above -- a bare
 * react-dom render, which is every server-side assertion in wordmark.test.tsx
 * -- and there the server's own href is the answer, unchanged.
 *
 * Not a second serializer: this is readSearchParams into jobsHref, the pair
 * use-listing.ts already runs on every render to decide whether the address bar
 * has moved. One reading of a URL, one spelling of it, so the mark cannot
 * disagree with the facet checkboxes about what state the board is in.
 */
function boardHref(params: ReadonlyURLSearchParams | null, rendered: string): string {
  if (!params) {
    return rendered;
  }

  return jobsHref(readSearchParams(new URLSearchParams(params.toString())));
}

/**
 * The board's wordmark: a mark whose href is still true after a facet tick.
 *
 * The panel filters without a round trip -- it pushes the new URL and re-derives
 * the list from the board already in memory -- and the marks sit in the @header
 * and @footer slots, which do not re-render for that. So a server-rendered href
 * is correct exactly once, and every tick after it hands the visitor back to the
 * board they had a tick ago.
 *
 * WHY THIS IS NOT A WRITE FROM navigate()
 *
 * Setting the anchor's href attribute from the handler that pushes would move
 * the address on hover and nothing else. next/link does not read the DOM: on
 * click it calls linkClicked with the `href` it was rendered with, which
 * dispatches that value as the navigation (client/app-dir/link.js). The
 * attribute and the destination would disagree, which is a worse bug than the
 * stale one it replaced -- so the href has to be a real prop, and the way to
 * keep a prop in step with the URL is to read the URL.
 *
 * Reading it is also what makes Back correct here for free: Next patches
 * pushState so useSearchParams holds the pushed URL, and popstate restores it
 * the same way, so both directions arrive through the one subscription.
 */
export function BoardLink({ className, href, children }: BoardLinkProps) {
  const params = useSearchParams();

  return (
    <Link className={className} href={boardHref(params, href)}>
      {children}
    </Link>
  );
}
