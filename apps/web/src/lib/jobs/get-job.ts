import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { jobTag } from "@/lib/jobs/cache-tags";
import { isJobId, type Job } from "@/lib/jobs/types";
import { restGet } from "@/lib/supabase/rest";

const COLUMNS = [
  "position_id",
  "display_job_id",
  "title",
  "department",
  "business_unit",
  "team",
  "location",
  "locations",
  "work_location_option",
  "work_type",
  "description_html",
  "description_text",
  "apply_url",
  "canonical_url",
  "posting_date",
  "source_created_at",
  // Embedded, not a second round trip. job_by_display_id returns `setof
  // public.jobs`, so PostgREST resolves the foreign key on
  // job_locations.job_position_id off the function's result exactly as it does
  // off the table -- checked against the running database, not assumed.
  "job_locations(location_slug)",
].join(",");

/** A posting as PostgREST returns it, with the join still nested. */
type JobRow = Omit<Job, "sites"> & {
  job_locations: { location_slug: string }[];
};

// Sorted for the same reason the board sorts them: PostgREST does not promise
// an order for an embedded resource, and a page whose location links change
// order between crawls is a page that looks like it changed.
function toJob(row: JobRow): Job {
  const { job_locations: joined, ...job } = row;

  return { ...job, sites: joined.map((entry) => entry.location_slug).sort() };
}

// Cached so the page is prerenderable: with `cacheComponents`, an uncached await
// here would make the whole route block on the request instead of streaming a
// static shell. The entry outlives any crawl schedule because the crawl is what
// ends it -- see the `jobs` profile in next.config.ts.
//
// Lookup goes through the job_by_display_id RPC rather than a column filter
// because PostgREST cannot express `upper(col) = upper($1)`. See
// supabase/migrations/20260805120000_job_display_id_lookup.sql. The match is
// case-insensitive at the database, so this never has to trust the caller's
// casing -- which matters because getJob is also reached by the prerender, not
// only by requests the proxy has already canonicalized.
export async function getJob(jobId: string): Promise<Job | null> {
  "use cache";
  cacheLife("jobs");
  // ONE tag, and it names this posting only. It used to carry the board tag as
  // well, so that a finished crawl could flush all 481 job pages without naming
  // any of them -- convenient while "the crawl ran" was the only signal the
  // ingestor had. It now compares a per-role content checksum and names the
  // roles that actually moved, so the blunt tag is not needed and is actively
  // wrong: it would put every posting inside the blast radius of one added role.
  cacheTag(jobTag(jobId));

  if (!isJobId(jobId)) {
    return null;
  }

  const rows = await restGet<JobRow[]>(
    `rpc/job_by_display_id?p_display_id=${encodeURIComponent(jobId)}&select=${COLUMNS}&limit=1`,
  );

  return rows[0] ? toJob(rows[0]) : null;
}
