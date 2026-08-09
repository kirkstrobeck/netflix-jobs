import type { Fix } from "@/lib/geo/fix";
import type { SiteBuckets } from "@/lib/jobs/nearby-sites";

// The browser half of /api/nearby. One function, so the hook that calls it is
// about state and this is about the wire.
//
// The response's bucketKm is read and discarded on purpose -- the client never
// does distance arithmetic, so the size of a ring is not something it needs to
// know. It is in the payload because a response that says "0, 0, 1" without
// saying what a 1 means is not self-describing, and this is a public endpoint.
type NearbyResponse = { bucketKm: number; buckets: SiteBuckets };

/**
 * Rings for one position, or null if the server could not say.
 *
 * Null rather than a throw: every caller would have to catch it, and there is
 * exactly one thing to do about it either way -- keep showing newest and say
 * so. A rejected promise here would end up as an unhandled rejection in the one
 * case that matters, which is the offline one.
 */
export async function requestNearby(fix: Fix): Promise<SiteBuckets | null> {
  try {
    const res = await fetch("/api/nearby", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fix),
    });

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as NearbyResponse;

    return payload.buckets;
  } catch {
    return null;
  }
}
