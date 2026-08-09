"use client";

import { useEffect, useState } from "react";

import type { Board } from "@/lib/jobs/board";

// A 200 that is not the board is a captive portal or a proxy's error page.
// Treating it as one would hand lib/search something it cannot filter, and a
// board with no sites would silently empty every country facet -- so the shape
// is checked before it is believed, and the listing stays on the server path.
function isBoard(value: unknown): value is Board {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { sites, jobs } = value as Partial<Board>;

  return Array.isArray(sites) && Array.isArray(jobs);
}

async function loadBoard(version: string, signal: AbortSignal): Promise<Board> {
  const response = await fetch(`/api/board?v=${encodeURIComponent(version)}`, { signal });

  if (!response.ok) {
    throw new Error(`GET /api/board -> ${response.status}`);
  }

  const board: unknown = await response.json();

  if (!isBoard(board)) {
    throw new Error("GET /api/board -> not a board");
  }

  return board;
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
export function useBoard(version: string): Board | null {
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    loadBoard(version, controller.signal)
      .then(setBoard)
      .catch(() => undefined);

    return () => controller.abort();
  }, [version]);

  return board;
}
