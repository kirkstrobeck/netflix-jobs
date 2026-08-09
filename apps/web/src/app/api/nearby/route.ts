import { parseFix } from "@/lib/geo/fix";
import { BUCKET_KM } from "@/lib/geo/metro-bucket";
import { nearbySites } from "@/lib/jobs/nearby-sites";

// The only server work Nearest needs: turn one position into one metro ring per
// office, using site_distance_km in Postgres.
//
// WHY THIS IS A ROUTE AND NOT PART OF THE RENDER
//
// The listing is server-rendered, and it is allowed to vary by exactly one
// thing: country. A position is not a country -- it is per visitor, it is not in
// the URL, and it arrives seconds after the page does, if it arrives at all.
// Reading it during a render would make the HTML depend on it, which is a second
// SSR dimension and, worse, one that cannot be cached, shared or crawled.
//
// So it lives here instead, behind its own address, and the listing never asks
// for it. The page renders newest for everyone; this answers a question the
// browser asks afterwards, only if the visitor pressed Nearest.
//
// POST, and not because anything is written. It is what keeps a coordinate out
// of the request line: a query string lands in access logs, in proxy caches and
// in Referer headers, and a body does not. It also settles the caching question
// by construction -- Next does not cache POST at all, under Cache Components or
// without it -- so there is no cache entry keyed on where someone is standing.
//
// Coordinates come in coarsened to about 1.1km by the browser (see
// lib/geo/fix.ts) and go out as ring numbers. At no point does this endpoint
// hold, log or return a precise position.
export async function POST(request: Request): Promise<Response> {
  const fix = parseFix(await request.json().catch(() => null));

  // 400 rather than an empty result. An empty map of rings is a legitimate
  // answer -- it is what a board with no located offices would give -- so
  // returning it for bad input would tell the client "nothing is near you"
  // when the truth is "that is not a place".
  if (!fix) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }

  return Response.json({ bucketKm: BUCKET_KM, buckets: await nearbySites(fix) });
}
