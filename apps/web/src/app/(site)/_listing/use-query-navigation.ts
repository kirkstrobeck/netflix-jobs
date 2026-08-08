"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { jobsHref, type JobQuery } from "@/lib/search/job-query";

/**
 * The one way any control changes the listing: write the new state to the URL
 * and let the server re-render from it. No control holds filter state of its
 * own, so the URL cannot drift out of step with what is on screen.
 *
 * push, not replace, so every filter change is a back-button step -- ticking a
 * box is a navigation a visitor expects to be able to undo.
 *
 * scroll: false, because the panel that changed is usually below the fold on a
 * narrow screen and jumping to the top would throw away the visitor's place.
 */
export function useQueryNavigation() {
  const router = useRouter();

  return useCallback(
    (query: JobQuery) => {
      router.push(jobsHref(query), { scroll: false });
    },
    [router],
  );
}
