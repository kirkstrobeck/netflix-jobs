import type { Job } from "@/lib/jobs/types";

// Google lists datePosted as REQUIRED: "The original date that employer posted
// the job in ISO 8601 format." 179 of the 481 rows have no posting_date -- the
// custom field Netflix fills in is simply empty on those postings -- so the
// question is what the page and the markup should say about them.
//
// Every one of those rows still has source_created_at (t_create), the moment the
// posting was created on Netflix's own board. That is a real crawled date, not a
// substitute invented to fill the slot, and for the 179 it sits in 2025-2026:
// oldest 2025-02-26, median 2026-06-07. Where BOTH exist they diverge -- median
// 41 days, up to 855 -- so posting_date is not derivable from it and wins
// wherever it is present.
//
// The verb travels with the date because the page renders it. Google's general
// guidelines want structured data to match what the visitor can read, and
// "Posted" against a record-creation date would be a claim the data does not
// support; "Listed" is what we can actually say. One function, so the fact in
// the header and datePosted in the JSON-LD cannot disagree.
export type PostedOn = { iso: string; verb: "Posted" | "Listed" };

export function postedOn(job: Job): PostedOn | null {
  if (job.posting_date) {
    return { iso: job.posting_date, verb: "Posted" };
  }

  if (job.source_created_at) {
    return { iso: job.source_created_at.slice(0, 10), verb: "Listed" };
  }

  return null;
}
