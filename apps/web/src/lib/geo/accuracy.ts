import { BUCKET_KM } from "@/lib/geo/metro-bucket";

/**
 * When a position is too vague to be presented as a position.
 *
 * The sort buckets at 50km, so a fix whose 95% radius is a good fraction of a
 * ring can put the visitor in the wrong one -- and a fix that came from an IP
 * address rather than a radio routinely is: tens of kilometres is normal, and
 * the browser reports it honestly in coords.accuracy. Half a ring is the line,
 * because a circle of that radius already spans a whole bucket's width and the
 * ordering it produces cannot be relied on at the resolution it is drawn at.
 *
 * Above this line the visitor is told. Below it they are not, because a
 * disclaimer on an accurate fix is noise that teaches people to ignore the one
 * that matters.
 */
export const COARSE_ACCURACY_M = (BUCKET_KM * 1000) / 2;

export function isCoarse(accuracyM: number | null): boolean {
  if (accuracyM === null || !Number.isFinite(accuracyM)) {
    return false;
  }

  return accuracyM >= COARSE_ACCURACY_M;
}

/**
 * The radius as a round number of kilometres, for saying out loud.
 *
 * Rounded to something a person would say -- "about 40 km" -- rather than to
 * the metre. A radius of 42,317m is not known to the metre, and printing it
 * that way is a second false precision inside the sentence that exists to
 * disclose the first one.
 */
export function accuracyKm(accuracyM: number): number {
  const km = accuracyM / 1000;

  if (km < 10) {
    return Math.max(1, Math.round(km));
  }

  return Math.round(km / 10) * 10;
}
