import "server-only";

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
// NO CACHE ENTRY OF ITS OWN, AND THAT IS A TAG DECISION.
//
// It used to be `use cache` under JOBS_BOARD_TAG. Tags propagate OUT of a nested
// cached scope into the entry that read it -- measured, not assumed: with this
// function tagged, a built /jobs/JR42022 carried
// `x-next-cache-tags: ...,job:JR42022,jobs-board` in its .meta. That is exactly
// the coupling this whole change exists to break. Firing the board tag would
// have flushed all 481 posting pages along with the listing, so "the board was
// invalidated and nothing else was" could not be true while this had a tag.
//
// Uncached, it is covered by whichever entry reads it -- BoardPage, boardBody,
// jobArticle -- and inherits that entry's lifetime and tags instead of adding
// its own. The cost is one 36-row query per cache MISS, which is per new facet
// combination and per changed posting, not per request.
//
// Freshness of the catalog itself is settled a level up: every row here is
// seeded from seedRows() in the ingestor, which is code. A changed catalog is a
// changed commit, a changed commit is a new build, and a new Build ID is part of
// every `use cache` key (03-api-reference/01-directives/use-cache.md, "Cache
// keys": "Build ID - Unique per build, changing this invalidates all cache
// entries"). So the catalog cannot go stale without a deploy that flushes it.
export async function listSites(): Promise<Site[]> {
  return restGet<Site[]>(`locations?select=${SITE_COLUMNS}&order=slug`);
}
