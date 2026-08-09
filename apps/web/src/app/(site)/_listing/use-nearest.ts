"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SiteBuckets } from "@/lib/jobs/nearby-sites";
import { locate, locationGranted } from "@/lib/geo/locate";
import { requestNearby } from "@/lib/geo/nearby-request";
import type { SortOrder } from "@/lib/search/sort-order";

/**
 * Where the visitor's position is up to. Every value is something the control
 * can say out loud -- there is no state that means "sorted by distance, we
 * think", because that is the one the visitor cannot check.
 */
export type NearestStatus =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "failed";

export type Nearest = {
  status: NearestStatus;
  buckets: SiteBuckets | null;
  /** The visitor pressed Nearest. The only call that can raise a prompt. */
  request: () => void;
};

/**
 * The geolocation island: the whole of the browser-only half of Nearest.
 *
 * WHAT MAKES THE PROMPT FIRE, AND WHAT DOES NOT
 *
 * `request` is wired to the Nearest control's click and to nothing else. There
 * is no call on mount, no prefetch while the visitor hovers, and no
 * "speculatively warm it up because they might" -- the permission dialog is a
 * modal interruption attributed to the site that caused it, and causing one
 * nobody asked for is how a site teaches people to press Block.
 *
 * The mount effect below is the one exception and it is not an exception at
 * all: it runs only for a URL that already says `sort=near`, and only after
 * navigator.permissions has confirmed the answer is already `granted`, which is
 * precisely the case where fetching a position raises nothing. A shared link
 * therefore lands sorted for the person who granted it before, and lands on a
 * control that waits to be pressed for everyone else.
 */
export function useNearest(sort: SortOrder): Nearest {
  const [status, setStatus] = useState<NearestStatus>("idle");
  const [buckets, setBuckets] = useState<SiteBuckets | null>(null);

  // Which attempt is current. A visitor who presses Nearest, then Newest, then
  // Nearest again has two flights in the air; without this the first one to
  // land wins, which can be the stale one. It also stops a setState after
  // unmount, and makes StrictMode's double-invoked mount effect idempotent.
  const attempt = useRef(0);

  const run = useCallback(async () => {
    const token = (attempt.current += 1);
    const current = () => token === attempt.current;

    setStatus("locating");

    const located = await locate();

    if (!current()) {
      return;
    }

    if ("failure" in located) {
      setStatus(located.failure);
      return;
    }

    const rings = await requestNearby(located.fix);

    if (!current()) {
      return;
    }

    // The position arrived and the server did not answer. Distinct from
    // `unavailable`, which is the device saying it cannot find itself -- one is
    // our fault and one is not, and the visitor is told which.
    if (!rings) {
      setStatus("failed");
      return;
    }

    setBuckets(rings);
    setStatus("ready");
  }, []);

  // Read once, at first render. The effect below is about the URL the visitor
  // ARRIVED on; later changes to `sort` are clicks, and clicks go through
  // `request`.
  const [arrivedNearest] = useState(() => sort === "nearest");

  useEffect(() => {
    if (!arrivedNearest) {
      return;
    }

    let live = true;

    locationGranted().then((granted) => {
      // Silent or nothing. If permission has not already been given, the
      // control shows "Nearest needs your location" and waits for a press --
      // which is the honest state, because at this point the list on screen IS
      // newest.
      if (live && granted) {
        void run();
      }
    });

    return () => {
      live = false;
    };
  }, [arrivedNearest, run]);

  const request = useCallback(() => {
    // Already have the rings. Switching back to Nearest after a detour through
    // Newest is a reorder of data we are holding, not a reason to spin up the
    // radio again -- and re-running would flash "Finding you" over a list that
    // is about to be correct anyway.
    if (buckets) {
      setStatus("ready");
      return;
    }

    void run();
  }, [buckets, run]);

  return { status, buckets, request };
}
