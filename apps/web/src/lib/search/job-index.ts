import type { SiteCatalog } from "@/lib/jobs/board";
import type { JobSummary } from "@/lib/jobs/job-summary";
import type { Site } from "@/lib/jobs/site";
import type { FacetKey } from "@/lib/search/job-query";

/**
 * The derived strings every filter pass needs, computed once per job.
 *
 * A keystroke re-runs five full passes over the board -- the results, plus one
 * per facet counted with its own selection open -- so 481 rows means ~2,400 job
 * tests. Doing the work below inside those tests is what made it expensive: the
 * keyword haystack alone is six string concatenations, an array spread, a join
 * and a toLowerCase, all of which produce the SAME string every time because the
 * job did not change. Only the query did.
 *
 * So it is hoisted out and keyed on the job object itself. A WeakMap rather than
 * a field on the row or a parallel array: the index cannot be stale, because a
 * different row object is a different key, and it is collected with the board it
 * describes rather than pinning a replaced crawl in memory.
 *
 * The catalog is an argument but NOT part of the key, which is safe for one
 * reason: a board and its site table arrive as one value (lib/jobs/board.ts) and
 * are cached under one tag, so a new catalog always comes with new job objects.
 */
type JobIndex = {
  team: string[];
  workType: string[];
  country: string[];
  site: string[];
  /** Lowercased, everything a keyword is allowed to match, joined. */
  keywords: string;
};

const INDEX = new WeakMap<JobSummary, JobIndex>();

// A slug with no row in the catalog is dropped rather than guessed at. The
// foreign key on job_locations makes it impossible from the database, so this
// only fires if a board and a site table were somehow paired across a crawl --
// in which case a posting quietly missing from one country's count is a better
// failure than a facet option labelled "undefined".
function sitesOf(job: JobSummary, catalog: SiteCatalog): Site[] {
  return job.sites
    .map((slug) => catalog.bySlug.get(slug))
    .filter((site): site is Site => site !== undefined);
}

function build(job: JobSummary, catalog: SiteCatalog): JobIndex {
  const sites = sitesOf(job, catalog);

  return {
    team: job.team ? [job.team] : [],
    workType: job.work_type ? [job.work_type] : [],
    // De-duplicated: a role open in Los Gatos AND as US-remote is one United
    // States role, not two, and the country count has to say 303 rather than
    // counting the same posting twice.
    country: [...new Set(sites.map((site) => site.country_code))],
    site: sites.map((site) => site.slug),
    // display_name carries the city, the region and the country in one string,
    // so "Los Gatos", "California" and "United States" all match without the
    // three being listed separately. description_text is deliberately absent:
    // it is twenty times the size of everything else combined and would have to
    // be cached in full to search it.
    keywords: [
      job.title,
      job.team ?? "",
      job.work_type ?? "",
      job.display_job_id ?? "",
      ...sites.map((site) => site.display_name),
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function indexOf(job: JobSummary, catalog: SiteCatalog): JobIndex {
  const cached = INDEX.get(job);

  if (cached) {
    return cached;
  }

  const built = build(job, catalog);
  INDEX.set(job, built);

  return built;
}

// The values a job offers to each facet. A job has one team and one work type
// but can be posted at several sites in several countries, so every facet is a
// list and the single-valued ones are lists of length one -- which lets counting
// and matching treat all four identically.
export function facetValues(
  job: JobSummary,
  key: FacetKey,
  catalog: SiteCatalog,
): string[] {
  return indexOf(job, catalog)[key];
}

export function keywordText(job: JobSummary, catalog: SiteCatalog): string {
  return indexOf(job, catalog).keywords;
}
