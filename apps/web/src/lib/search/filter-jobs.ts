import { jobLocations, type JobSummary } from "@/lib/jobs/job-summary";
import { formatLocation } from "@/lib/format/location";
import type { FacetKey, JobQuery } from "@/lib/search/job-query";

// The values a job offers to each facet. A job has one team and one work type
// but can be posted in several locations, so every facet is a list and the
// single-valued ones are lists of length one -- which lets counting and matching
// treat all three identically.
export function facetValues(job: JobSummary, key: FacetKey): string[] {
  if (key === "team") {
    return job.team ? [job.team] : [];
  }

  if (key === "workType") {
    return job.work_type ? [job.work_type] : [];
  }

  return jobLocations(job);
}

// OR within a facet: picking Engineering and Marketing widens the result set,
// which is what a visitor ticking two boxes in one list means.
function matchesFacet(job: JobSummary, key: FacetKey, selected: string[]): boolean {
  if (selected.length === 0) {
    return true;
  }

  return facetValues(job, key).some((value) => selected.includes(value));
}

// Keywords search the fields the listing actually holds. description_text is
// deliberately absent: it is twenty times the size of everything else combined
// and would have to be cached in full to search it here. Locations are matched
// in their formatted form as well as their stored one, so "New York" finds a job
// stored as "New York,New York,United States of America".
function haystack(job: JobSummary): string {
  const locations = jobLocations(job);

  return [
    job.title,
    job.team ?? "",
    job.work_type ?? "",
    job.display_job_id ?? "",
    ...locations,
    ...locations.map(formatLocation),
  ]
    .join(" ")
    .toLowerCase();
}

// AND across keywords: each chip narrows. Two chips that individually match
// nothing together are not a reason to widen back out.
function matchesKeywords(job: JobSummary, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return true;
  }

  const text = haystack(job);

  return keywords.every((keyword) => text.includes(keyword.trim().toLowerCase()));
}

// `ignore` drops one facet from the test. Facet counting needs "everything else
// applied, this facet open", which is how an option can still show a count after
// its own list has a selection in it.
export function matchesQuery(
  job: JobSummary,
  query: JobQuery,
  ignore?: FacetKey,
): boolean {
  const facets: FacetKey[] = ["team", "workType", "location"];

  return (
    facets.every(
      (key) => key === ignore || matchesFacet(job, key, query[key]),
    ) && matchesKeywords(job, query.keywords)
  );
}

export function filterJobs(
  jobs: JobSummary[],
  query: JobQuery,
  ignore?: FacetKey,
): JobSummary[] {
  return jobs.filter((job) => matchesQuery(job, query, ignore));
}
