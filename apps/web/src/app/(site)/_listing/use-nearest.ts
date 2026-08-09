"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SiteBuckets } from "@/lib/jobs/nearby-sites";
import { placeName } from "@/lib/geo/geocoder";
import {
  locate,
  locationGranted,
  watchLocationPermission,
  type PermissionState,
} from "@/lib/geo/locate";
import { requestNearby } from "@/lib/geo/nearby-request";
import type { SortOrder } from "@/lib/search/sort-order";

/**
 * Where the visitor's position is up to.
 *
 * FOUR STATES, DOWN FROM EIGHT
 *
 * There used to be one per failure mode -- denied, unavailable, timeout,
 * unsupported, failed -- because each one had its own sentence apologising for
 * the list being ordered newest instead. Those sentences are gone: Nearest no
 * longer falls back to newest, so there is nothing to apologise for and nothing
 * to tell the five cases apart FOR. What is left is whether we have a position.
 *
 * Why a position was not obtained is still worth exactly one distinction, and it
 * is not in this type: whether the permission is blocked, which decides whether
 * offering to try again is a real offer or a dead button. That comes off
 * `permission`, which is a fact about the browser rather than about our attempt.
 */
export type NearestStatus = "idle" | "locating" | "ready" | "failed";

export type Nearest = {
  status: NearestStatus;
  buckets: SiteBuckets | null;
  /**
   * The device fix's radius in metres, once there is one. Never sent anywhere;
   * it decides whether the visitor is told the position may be well off.
   */
  accuracyM: number | null;
  /** Reverse-geocoded place name. Null until a geocoder is configured. */
  place: string | null;
  /** Whether the browser will even consider prompting. Drives the retry copy. */
  permission: PermissionState;
  /** The visitor pressed Nearest, or Use my location. The only call that can prompt. */
  request: () => void;
};

/**
 * The geolocation island: the whole of the browser-only half of Nearest.
 *
 * WHAT MAKES THE PROMPT FIRE, AND WHAT DOES NOT
 *
 * `request` is wired to a press and to nothing else. There is no call on mount,
 * no prefetch on hover, and no speculative warm-up -- the permission dialog is a
 * modal interruption attributed to the site that caused it, and causing one
 * nobody asked for is how a site teaches people to press Block.
 *
 * The two effects below are not exceptions to that. The first only queries
 * navigator.permissions, which never prompts; the second fetches a position only
 * after that query has already confirmed the answer is `granted`, which is
 * precisely the case where fetching one raises nothing.
 */
export function useNearest(sort: SortOrder): Nearest {
  const [status, setStatus] = useState<NearestStatus>("idle");
  const [buckets, setBuckets] = useState<SiteBuckets | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>("unknown");

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

    // Every way of not having a position is the same state now. Which one it
    // was is only interesting for the retry copy, and that reads `permission`.
    if ("failure" in located) {
      setStatus("failed");
      return;
    }

    const rings = await requestNearby(located.fix);
    const named = await placeName(located.fix);

    if (!current()) {
      return;
    }

    // The position arrived and the server did not answer. The rings are what
    // distance ordering is made of, so without them there is no device tier --
    // the listing stays at whatever coarser tier it was already at.
    if (!rings) {
      setStatus("failed");
      return;
    }

    setAccuracyM(located.accuracyM);
    setPlace(named);
    setBuckets(rings);
    setStatus("ready");
  }, []);

  // Read once, at first render. The effect below is about the URL the visitor
  // ARRIVED on; later changes to `sort` are clicks, and clicks go through
  // `request`.
  const [arrivedNearest] = useState(() => sort === "nearest");

  // The permission, now and whenever it changes -- including a change made in
  // browser UI while this page is open, which is the only way a denial is ever
  // lifted. Nothing here prompts.
  useEffect(() => watchLocationPermission(setPermission), []);

  useEffect(() => {
    if (!arrivedNearest) {
      return;
    }

    let live = true;

    locationGranted().then((granted) => {
      // Silent or nothing. Without an existing grant the listing sits at its
      // country tier and the offer below the heading waits for a press, which
      // is the honest state: the list IS ordered, just not from a point.
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

  return { status, buckets, accuracyM, place, permission, request };
}
