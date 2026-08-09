/**
 * How far apart two offices have to be before "nearest" is allowed to separate
 * them.
 *
 * WHY 50 KM
 *
 * A metro is a commuting shed, not a point. 50km is the radius the standard
 * definitions land on -- a US Census CBSA and a Eurostat functional urban area
 * are both drawn from where people commute from, which is about 45-60 minutes
 * out -- and the board's own site table agrees with it. Measured over the 31
 * located sites in packages/ingestor/lib/sites-seed.ts, sorted by how close two
 * of them are:
 *
 *     15.5km  us-burbank    <-> us-los-angeles
 *     65.0km  tw-hsinchu    <-> tw-taipei-city
 *     80.3km  us-new-jersey <-> us-new-york
 *    195.3km  ca-vancouver  <-> us-seattle
 *
 * There is exactly one pair that is unarguably ONE metro -- Burbank and Los
 * Angeles, 15.5km, both Greater LA -- and the next pair up is a different city
 * an hour's train away. 50km is inside that gap: it merges the pair that has to
 * merge and splits every pair that should stay split. It is not a round number
 * chosen first and justified afterwards; 25km would break Burbank off LA, and
 * 100km would fold Hsinchu into Taipei and central New Jersey into New York.
 *
 * WHAT BUCKETING BUYS
 *
 * Ordering on the raw kilometre would let two roles in the same city trade
 * places because one office is 400m further down the street, which is noise
 * presented as a ranking -- especially since the coordinates are city centres,
 * not street addresses, so those 400m are not even real. Inside a bucket the
 * distance stops being a sort key at all and the list falls back to newest,
 * which is what "both here, newer first" means.
 *
 * THE EDGE, STATED HONESTLY
 *
 * A fixed grid has boundaries, so two sites 15km apart CAN land either side of
 * one if the visitor happens to sit 50km from the first. That is inherent to
 * bucketing rather than a bug in the number, and it costs at most one position
 * between two genuinely different cities. What it never does is reorder two
 * roles at the SAME site: identical coordinates give an identical distance and
 * therefore always the same bucket, so the case the rule exists for is exact.
 */
export const BUCKET_KM = 50;

/**
 * Which ring a distance falls in. 0 is "in this metro", 1 is the next 50km out.
 *
 * Rejects anything that is not a finite number rather than coercing it: a NaN
 * here would compare false against everything and shuffle the list at random.
 */
export function metroBucket(km: number): number | null {
  if (!Number.isFinite(km) || km < 0) {
    return null;
  }

  return Math.floor(km / BUCKET_KM);
}
