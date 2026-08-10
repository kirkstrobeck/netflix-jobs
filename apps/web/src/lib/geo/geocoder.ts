import type { Fix } from "@/lib/geo/fix";

/**
 * The seam where a geocoder plugs in. THERE IS NO GEOCODER YET.
 *
 * Two directions are needed and they are not the same problem:
 *
 *   FORWARD   a typed city -> a position. This is the one the retry path needs,
 *             because it is the only way a visitor who will never re-grant the
 *             browser permission can still say where they are.
 *   REVERSE   a position -> a place name. This is what would let the heading say
 *             "nearest to Beaverton, Oregon" instead of "nearest to you".
 *
 * Neither is implemented and no credential has been provisioned, so no
 * deployment names a provider and the switch below is off everywhere. The
 * geocoding service the reference implementation uses could not be identified
 * from in here -- that repository is not on this filesystem; see the report.
 *
 * FAIL CLOSED, DELIBERATELY
 *
 * Both functions return null when nothing is configured, and callers render the
 * feature away rather than degrading it. Specifically NOT done:
 *
 *   - no unauthenticated fallback to a public Nominatim, which would be both a
 *     usage-policy violation and a silent downgrade to a different data set
 *   - no bundled key. A forward geocode from the browser would put the
 *     credential in the client bundle; when this is wired up it goes through a
 *     route handler, like /api/nearby, and the key stays on the server
 *   - no country centroid standing in for a reverse geocode. A centroid drops a
 *     US visitor in Kansas and would order Los Gatos behind roles genuinely
 *     closer to them: a precise-looking wrong answer, which is worse than the
 *     coarse right one. Coarser wording is the fallback, never a fabricated
 *     position
 *
 * When a credential arrives, implement these two and nothing above them changes:
 * `placeName` feeds the heading's device tier, `geocodeCity` feeds the typed
 * -city half of the location offer, and both call sites already handle null.
 */

/**
 * Configured when a provider has been named for this deployment.
 *
 * THE NAME IS PUBLIC, THE CREDENTIAL IS NOT
 *
 * This is read in the browser -- `placeName` is called from the nearest-sort
 * hook -- so it cannot be the key, and deliberately is not. All the browser is
 * allowed to know is whether a provider exists at all, which is the only thing
 * it needs in order to decide between offering the feature and rendering it
 * away. The key lives beside the route handler that will do the call.
 *
 * Unset is the deployed answer today, and an empty string counts as unset: that
 * is what a deployment variable holds when it has been declared and never
 * given a value, and it must not read as "yes, there is a geocoder".
 */
export function geocoderConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_GEOCODER ?? "").trim() !== "";
}

// Both entry points check `geocoderConfigured()` first and return null, so the
// callers' "we cannot say" path is the one that runs today and is therefore the
// one that is exercised. Past that check is where the provider call goes; it
// throws rather than returning null so that turning the flag on without
// implementing them fails loudly instead of looking like a geocoder that never
// recognises anywhere.

/** REVERSE: a position to a human place name, or null if we cannot say. */
export async function placeName(fix: Fix): Promise<string | null> {
  if (!geocoderConfigured()) {
    return null;
  }

  throw new Error(`No reverse geocoder implemented for ${fix.lat},${fix.lng}`);
}

/** FORWARD: a typed city to a position, or null if we cannot place it. */
export async function geocodeCity(city: string): Promise<Fix | null> {
  if (!geocoderConfigured()) {
    return null;
  }

  throw new Error(`No forward geocoder implemented for ${city}`);
}
