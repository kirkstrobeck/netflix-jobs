import "server-only";

import type { Fix } from "@/lib/geo/fix";
import { metroBucket } from "@/lib/geo/metro-bucket";
import { restRpc } from "@/lib/supabase/rpc";

type DistanceRow = { slug: string; distance_km: number };

/**
 * Every office that has coordinates, as the metro ring it falls in from one
 * point. Slugs with no entry have no distance -- see below.
 */
export type SiteBuckets = Record<string, number>;

/**
 * The visitor's position turned into the only thing the listing needs from it.
 *
 * What comes back is a ring number per office, not a kilometre and not a
 * position. The distance is computed in Postgres by site_distance_km -- the
 * function the locations migration exists to make usable -- and the rounding to
 * a bucket happens here, on the server, so the exact metres never cross back
 * over the wire either. A response that says "us-los-angeles: 0, us-burbank: 0"
 * is not enough to work out where the visitor was standing.
 *
 * REMOTE SCOPES ARE ABSENT, NOT FAR
 *
 * sites_by_distance only returns rows that HAVE coordinates, so a remote scope
 * simply is not in this object. That is the shape the whole feature depends on:
 * there is no number a caller can accidentally read as zero, and no sentinel to
 * misinterpret. The absence is the fact. Where those roles then sort is a
 * listing decision made in sort-jobs.ts, out loud.
 */
export async function nearbySites(fix: Fix): Promise<SiteBuckets> {
  const rows = await restRpc<DistanceRow[]>("sites_by_distance", {
    lat: fix.lat,
    lng: fix.lng,
  });

  const buckets: SiteBuckets = {};

  rows.forEach((row) => {
    const bucket = metroBucket(row.distance_km);

    // A null distance cannot reach here -- the function filters those rows out
    // -- but a caller that skipped the check would be writing `undefined` into
    // the map under a real slug, which reads downstream as "this office has no
    // coordinates". Dropping the row keeps that one meaning intact.
    if (bucket !== null) {
      buckets[row.slug] = bucket;
    }
  });

  return buckets;
}
