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

  const rows = await restGet<Array<{ position_id: number }>>(
    `jobs?select=position_id&is_active=eq.true&order=posting_date.desc.nullslast&limit=${SAMPLE_SIZE}`,
  );

  return rows.map((row) => String(row.position_id));
}
