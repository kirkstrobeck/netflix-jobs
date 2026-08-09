import "server-only";

import { createHash } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";

import { JOBS_BOARD_TAG } from "@/lib/jobs/cache-tags";
import { loadBoard } from "@/lib/jobs/load-board";

/**
 * The whole board, serialised once per cache entry, for the client to filter.
 *
 * WHY A ROUTE HANDLER AND NOT INLINE JSON
 *
 * The obvious alternative is a <script type="application/json"> in the page, or
 * the board passed as a prop to a Client Component. Both put 143KB into the HTML
 * of EVERY listing URL -- and there are thousands of them, one per facet
 * combination -- so every one of those documents grows by the full board, none
 * of them share a byte with each other, and the cost lands on first paint, which
 * is the one thing that must not get slower. A separate URL is fetched once,
 * cached once, and reused by every subsequent URL the visitor lands on.
 *
 * TRANSFERRED SIZE
 *
 * 481 postings and 36 sites, 107,714 bytes of JSON, 15,014 gzipped and 11,484
 * brotli (measured with zlib over the live board; `compress: true` in
 * next.config.ts does the encoding). A columnar {keys, rows[][]} encoding was
 * measured too: 6% off the wire for an encoder and a decoder that can disagree
 * with each other, and rows that no longer arrive as the JobSummary shape
 * lib/search already takes. Not worth it; the repeated keys that make the raw
 * number look bad are exactly what a compressor eats.
 *
 * Slugs replaced the raw location strings here, and the raw payload fell 25%
 * (143,495 -> 107,714) because 'Los Angeles,California,United States of
 * America' became 'us-los-angeles'. Compressed it is 2% BIGGER: those long
 * strings repeated across 670 rows were exactly what gzip was best at, and 36
 * site records had to be added to resolve the slugs. The trade is taken anyway
 * -- the client needs a country per posting, and deriving one from a string the
 * board spells five ways is the parsing the ingestor already did once.
 *
 * FRESHNESS
 *
 * cacheTag(JOBS_BOARD_TAG) puts this behind the same lever as everything else,
 * so POST /api/revalidate after a crawl drops it with the listing. That handles
 * the server. It cannot reach a browser that already has the file, which is why
 * the URL carries boardVersion() -- see the route handler.
 */
export async function boardBody(): Promise<string> {
  "use cache";
  cacheLife("jobs");
  cacheTag(JOBS_BOARD_TAG);

  return JSON.stringify(await loadBoard());
}

/**
 * A short digest of the exact bytes boardBody() will serve.
 *
 * Derived from the body rather than from a row count or a max(posting_date):
 * a retitled job changes neither of those, and the point of this string is that
 * it differs whenever a single byte does.
 *
 * Its own cache entry, so a page render reads 12 characters instead of pulling
 * 143KB through the cache to hash it again. Both entries carry the board tag, so
 * they are replaced together and the version can never name a body that has
 * already been flushed.
 */
export async function boardVersion(): Promise<string> {
  "use cache";
  cacheLife("jobs");
  cacheTag(JOBS_BOARD_TAG);

  return createHash("sha256").update(await boardBody()).digest("base64url").slice(0, 12);
}
