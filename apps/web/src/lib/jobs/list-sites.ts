import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { JOBS_BOARD_TAG } from "@/lib/jobs/cache-tags";
import { SITE_COLUMNS, type Site } from "@/lib/jobs/site";
import { restGet } from "@/lib/supabase/rest";

// The whole site table, every row of it, ordered by slug.
//
// No filter and no join to the postings: 36 rows is smaller than the query that
// would narrow it, and a site with nothing open today is one crawl away from
// having something. What decides whether a country or an office appears in the
// facet is the COUNT over the board, not the presence of a row here -- so this
// stays the plain table and the listing does the arithmetic.
//
// Same tag and the same cache profile as the board it describes, so the two are
// flushed by the same POST /api/revalidate and can never be a crawl apart.
export async function listSites(): Promise<Site[]> {
  "use cache";
  cacheLife("jobs");
  cacheTag(JOBS_BOARD_TAG);

  return restGet<Site[]>(`locations?select=${SITE_COLUMNS}&order=slug`);
}
