import { cacheLife, cacheTag } from "next/cache";

import { Listing } from "@/app/(site)/_listing/listing";
import { boardVersion } from "@/lib/jobs/board-payload";
import { JOBS_BOARD_TAG } from "@/lib/jobs/cache-tags";
import { loadBoard } from "@/lib/jobs/load-board";
import type { JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

/**
 * ONE CACHE ENTRY PER FACET COMBINATION, HOLDING FINISHED MARKUP.
 *
 * `use cache` keys an entry on the serialized arguments, so `query` IS the key:
 * `/?country=US` and `/?country=US&level=senior` parse to two different objects
 * and get two different entries. Nothing else varies -- the server is never told
 * where the visitor is and never reads a cookie -- so the entry is the same
 * bytes for everyone who asks for that URL.
 *
 * Entries are made lazily, on the request that first asks for one. There is no
 * generateStaticParams here and no enumeration of the combinations: a URL nobody
 * visits costs nothing, and the first visitor to a new one pays a Supabase-free
 * derive over the board entry that is already warm.
 *
 * The key is the PARSED query, not the raw query string, which is why it is
 * parsed one level up and passed in. parseJobQuery lower-cases, de-duplicates
 * and sorts, so `?country=us&team=Engineering` and `?team=Engineering&country=US`
 * are one entry rather than two copies of one screen. proxy.ts already redirects
 * most of that away; this makes the rest free.
 *
 * WHAT IS NOT IN THE KEY
 *
 * The visitor's position. `?sort=near` is in the URL and therefore in the key,
 * but a position is not: deriveListing is called with two arguments here and
 * never three, so every cached entry is the newest-first list. Nearest is
 * applied after paint, in the browser, over the board it fetches for itself --
 * see use-listing.ts. A coordinate never reaches this function and so can never
 * reach a shared cache entry.
 */
export async function BoardPage({ query }: { query: JobQuery }) {
  "use cache";
  cacheLife("jobs");
  cacheTag(JOBS_BOARD_TAG);

  const board = await loadBoard();

  return (
    <Listing
      boardVersion={await boardVersion()}
      initialQuery={query}
      initialView={deriveListing(board, query)}
    />
  );
}
