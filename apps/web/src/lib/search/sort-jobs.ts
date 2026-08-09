import type { SiteBuckets } from "@/lib/jobs/nearby-sites";
import type { JobSummary } from "@/lib/jobs/job-summary";
import type { SortOrder } from "@/lib/search/sort-order";

/**
 * Where a role with no coordinates goes.
 *
 * AFTER every located one, and the number is finite on purpose. Infinity would
 * make `a.bucket - b.bucket` produce NaN for two remote roles compared against
 * each other, and a comparator that returns NaN leaves the engine free to
 * arrange them however it likes -- which is exactly the shuffling this file
 * exists to prevent.
 *
 * WHY LAST, AND NOT FIRST
 *
 * A remote scope has no coordinates by design: 'USA - Remote' is a country, not
 * a place inside it, and the database will reject a remote row that grows a
 * point. So the honest answer to "how far is this from you" is not a number,
 * and every position on a distance-ordered list is a claim about a number.
 * First would claim "nearer than the office you can see out of the window";
 * zero would claim it is where you are standing. Last claims the least: these
 * are the roles the question does not apply to, so they come after the ones it
 * does, still newest-first among themselves.
 *
 * It also matches what the data model already decided. site_distance_km is
 * `strict`, and the migration that introduced it says so in a comment: `order
 * by site_distance_km(...) asc nulls last` puts a remote scope after every real
 * office instead of ahead of all of them. This is that same sentence, in
 * TypeScript.
 *
 * The country facet is what actually serves someone who wants remote work in
 * their own country -- it is a filter, and filtering is the control for "only
 * show me these", which sorting has never been.
 */
export const UNPLACED = Number.MAX_SAFE_INTEGER;

/**
 * A role's ring: its NEAREST site's.
 *
 * A posting can name several. 'Los Angeles or New York' is one role you could
 * take in either place, so the one that decides where it sits in a
 * distance-ordered list is the closest of them -- the same answer a person
 * would give if asked how far away the job is.
 */
export function jobBucket(job: JobSummary, buckets: SiteBuckets): number {
  return job.sites.reduce((best, slug) => {
    const bucket = buckets[slug];

    // undefined means the site is not in the map, which means it has no
    // coordinates. Skipped rather than coerced: this is the one place the
    // absence could turn into a zero, and it does not.
    if (bucket === undefined) {
      return best;
    }

    return Math.min(best, bucket);
  }, UNPLACED);
}

/**
 * The same rows, in ring order.
 *
 * Bucket is the ONLY key. There is no tie-break comparator because there does
 * not need to be one: the array arriving here is already newest-first -- the
 * board is ordered posting_date desc at the database and filtering preserves
 * that -- and Array.prototype.sort has been stable since ES2019. So two roles
 * in one ring keep the order they came in, which is newest first. Adding a
 * date comparison would be a second implementation of an ordering that already
 * holds, and one that could disagree with the database's own nullslast rule for
 * a posting with no date.
 */
export function sortByNearest(jobs: JobSummary[], buckets: SiteBuckets): JobSummary[] {
  return jobs
    .map((job) => ({ job, bucket: jobBucket(job, buckets) }))
    .sort((a, b) => a.bucket - b.bucket)
    .map((entry) => entry.job);
}

/**
 * The one place the listing decides what order it is in.
 *
 * Nearest without buckets is NEWEST, not an error and not an empty list. That
 * is the whole degrade path in one line: the server always lands here without
 * buckets, so a `?sort=near` URL renders newest on the server; and a browser
 * whose position was denied, unavailable or slow lands here without them too,
 * and gets the same list it would have had. What the visitor is TOLD in that
 * case is a separate job, done by the control -- silently serving newest while
 * the button says Nearest is the failure this signature is shaped to avoid,
 * which is why the caller has to hold the buckets and therefore knows whether
 * they exist.
 */
export function orderResults(
  jobs: JobSummary[],
  sort: SortOrder,
  buckets: SiteBuckets | null,
): JobSummary[] {
  if (sort !== "nearest" || !buckets) {
    return jobs;
  }

  return sortByNearest(jobs, buckets);
}
