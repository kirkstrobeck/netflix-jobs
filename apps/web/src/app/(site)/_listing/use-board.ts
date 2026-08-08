"use client";

import { useEffect, useState } from "react";

import type { JobSummary } from "@/lib/jobs/job-summary";

async function loadBoard(version: string, signal: AbortSignal): Promise<JobSummary[]> {
  const response = await fetch(`/api/board?v=${encodeURIComponent(version)}`, { signal });

  if (!response.ok) {
    throw new Error(`GET /api/board -> ${response.status}`);
  }

  const jobs: unknown = await response.json();

  // A 200 that is not an array is a captive portal or a proxy's error page, not
  // a board. Treating it as one would hand lib/search something it cannot
  // filter; throwing here keeps the listing on the server path instead.
  if (!Array.isArray(jobs)) {
    throw new Error("GET /api/board -> not an array");
  }

  return jobs as JobSummary[];
}

/**
 * The board, once it has arrived. Null until then, and null forever if it never
 * does -- which is the whole contract: the caller reads null as "keep using the
 * server", not as "loading".
 *
 * In an effect, so it runs after hydration and after the first paint, off the
 * critical path. The page is already complete and interactive without it.
 *
 * The failure path is deliberately silent. There is nothing to tell a visitor:
 * every control still works, it just costs a round trip, which is precisely
 * what the site did before any of this existed.
 */
export function useBoard(version: string): JobSummary[] | null {
  const [board, setBoard] = useState<JobSummary[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    loadBoard(version, controller.signal)
      .then(setBoard)
      .catch(() => undefined);

    return () => controller.abort();
  }, [version]);

  return board;
}
