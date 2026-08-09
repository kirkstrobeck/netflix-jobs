"use client";

import { createContext, useContext } from "react";

import type { JobQuery } from "@/lib/search/job-query";

/**
 * The one way any control changes the listing: hand it the new query.
 *
 * No control holds filter state of its own and none of them knows whether the
 * change will cost a round trip -- useListing decides that in one place, by
 * whether the board has arrived. A facet, a chip and a page link are the same
 * call, so they cannot drift apart in how they navigate.
 */
export type Navigate = (query: JobQuery, fragment?: string) => void;

const NavigateContext = createContext<Navigate | null>(null);

export const NavigateProvider = NavigateContext.Provider;

export function useQueryNavigation(): Navigate {
  const navigate = useContext(NavigateContext);

  // A control rendered outside the listing would otherwise push to the URL with
  // nothing listening, which looks like a filter that half works. Failing loudly
  // is the only version of this that gets noticed.
  if (!navigate) {
    throw new Error("useQueryNavigation must be used inside the listing");
  }

  return navigate;
}
