import { Listing } from "@/app/(site)/_listing/listing";
import { boardVersion } from "@/lib/jobs/board-payload";
import { loadBoard } from "@/lib/jobs/load-board";
import { deriveListing } from "@/lib/search/listing-view";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/parse-query";

type JobListingProps = { searchParams: Promise<RawSearchParams> };

// The first paint for any URL is made here, on the server: parse the URL, derive
// the whole screen from the cached board, send finished HTML. A copied link
// renders the same on someone else's machine, with JavaScript off, and to a
// crawler.
//
// What is sent down is the DERIVED view -- one page of rows and the counted
// facet options -- not the board. The board is 108KB and there are thousands of
// these URLs; inlining it into each of them would put the whole thing in every
// document and none of them would share a byte. It arrives once, separately,
// from /api/board, and boardVersion is the digest that names which copy.
//
// THE URL IS THE WHOLE INPUT
//
// It used to not be. A country could reach this render by two other routes -- a
// cookie, and the country the edge read off the request -- and applyCountryDefault
// folded them in here, which meant a filtered listing could be served from an
// address that did not mention the filter.
//
// Both of those are now settled in proxy.ts, before this component exists, by a
// redirect to the URL that says so. So there is nothing left to fold in: this
// reads searchParams and only searchParams, which is what makes the render a
// pure function of the address bar. It is also what makes the response
// shareable -- everything it varies on is now in the cache key. See
// cache-headers.ts.
export async function JobListing({ searchParams }: JobListingProps) {
  const board = await loadBoard();
  const query = parseJobQuery(await searchParams);

  return (
    <Listing
      boardVersion={await boardVersion()}
      initialQuery={query}
      initialView={deriveListing(board, query)}
    />
  );
}
