import { formatLocation } from "@/lib/format/location";
import { jobLocations, type JobSummary } from "@/lib/jobs/job-summary";
import type { FacetKey } from "@/lib/search/job-query";

/**
 * The derived strings every filter pass needs, computed once per job.
 *
 * A keystroke re-runs four full passes over the board -- the results, plus one
 * per facet counted with its own selection open -- so 481 rows means ~1,900 job
 * tests. Doing the work below inside those tests is what made it expensive: the
 * keyword haystack alone is six string concatenations, an array spread, a join
 * and a toLowerCase, all of which produce the SAME string every time because the
 * job did not change. Only the query did.
 *
 * So it is hoisted out and keyed on the job object itself. A WeakMap rather than
 * a field on the row or a parallel array: the index cannot be stale, because a
 * different row object is a different key, and it is collected with the board it
 * describes rather than pinning a replaced crawl in memory.
 */
type JobIndex = {
  team: string[];
  workType: string[];
  location: string[];
  /** Lowercased, everything a keyword is allowed to match, joined. */
  keywords: string;
};

const INDEX = new WeakMap<JobSummary, JobIndex>();

// Locations are matched in their formatted form as well as their stored one, so
// "New York" finds a job stored as "New York,New York,United States of America".
//
// description_text is deliberately absent: it is twenty times the size of
// everything else combined and would have to be cached in full to search it.
function build(job: JobSummary): JobIndex {
  const locations = jobLocations(job);

  return {
    team: job.team ? [job.team] : [],
    workType: job.work_type ? [job.work_type] : [],
    location: locations,
    keywords: [
      job.title,
      job.team ?? "",
      job.work_type ?? "",
      job.display_job_id ?? "",
      ...locations,
      ...locations.map(formatLocation),
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function indexOf(job: JobSummary): JobIndex {
  const cached = INDEX.get(job);

  if (cached) {
    return cached;
  }

  const built = build(job);
  INDEX.set(job, built);

  return built;
}

// The values a job offers to each facet. A job has one team and one work type
// but can be posted in several locations, so every facet is a list and the
// single-valued ones are lists of length one -- which lets counting and matching
// treat all three identically.
export function facetValues(job: JobSummary, key: FacetKey): string[] {
  return indexOf(job)[key];
}

export function keywordText(job: JobSummary): string {
  return indexOf(job).keywords;
}
