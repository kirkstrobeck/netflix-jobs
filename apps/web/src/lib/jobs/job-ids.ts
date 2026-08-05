import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { restGet } from "@/lib/supabase/rest";

const SAMPLE_SIZE = 12;

// `generateStaticParams` must return at least one param when `cacheComponents` is
// on. Supplying a sample is also what stops `params` from counting as a runtime
// API, which is what lets the page await it without a <Suspense> boundary.
// Every other id still renders on demand via the default `dynamicParams`.
export async function listRecentJobIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");

  const rows = await restGet<Array<{ display_job_id: string | null }>>(
    `jobs?select=display_job_id&is_active=eq.true&display_job_id=not.is.null&order=posting_date.desc.nullslast&limit=${SAMPLE_SIZE}`,
  );

  // The column is nullable in the schema even though all 481 current rows have
  // it, and a null here would prerender /jobs/null. The filter above asks the
  // database to exclude them; this narrows the type to match.
  return rows
    .map((row) => row.display_job_id)
    .filter((jobId): jobId is string => jobId !== null);
}
