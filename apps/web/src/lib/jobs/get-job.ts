import "server-only";

import { cacheLife, cacheTag } from "next/cache";

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
].join(",");

// Cached so the page is prerenderable: with `cacheComponents`, an uncached await
// here would make the whole route block on the request instead of streaming a
// static shell. The board is crawled on a schedule, so hours-old data is correct.
export async function getJob(jobId: string): Promise<Job | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs", `job:${jobId}`);

  if (!isJobId(jobId)) {
    return null;
  }

  const rows = await restGet<Job[]>(
    `jobs?select=${COLUMNS}&position_id=eq.${jobId}&limit=1`,
  );

  return rows[0] ?? null;
}
