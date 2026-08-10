// The tag names, in one place, because two sides have to agree on them and they
// are never in the same file: the readers that call cacheTag (list-jobs,
// get-job, job-ids) and the route handler that calls revalidateTag. A typo in a
// tag name does not fail anything -- it silently invalidates nothing -- so the
// string is not repeated anywhere.

// Everything derived from the whole board carries this: the board and site
// reads, the /api/board payload, and every rendered listing URL. A posting's
// page does NOT -- it used to, so that "the crawl ran" could flush all 481 of
// them at once, and the ingestor now knows better than that. The ingestor fires
// this tag only when the SET the board shows moved: a role added, a role
// removed, or a change to a field the board displays or filters on.
export const JOBS_BOARD_TAG = "jobs-board";

// Per job, so one posting can be invalidated without dropping the other 480.
//
// Uppercased because display_job_id is stored uppercase and getJob is reached
// with whatever casing the caller had -- the proxy canonicalizes /jobs/jr41912
// to /jobs/JR41912 for visitors, but the prerender and generateMetadata call
// getJob directly. Tagging on the canonical form means one revalidation covers
// every casing rather than leaving stale mixed-case entries behind.
export function jobTag(jobId: string): string {
  return `job:${jobId.toUpperCase()}`;
}
