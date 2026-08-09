import { Listing } from "@/app/(site)/_listing/listing";
import { countryDefault } from "@/lib/geo/detect-country";
import { openCountries } from "@/lib/jobs/board";
import { boardVersion } from "@/lib/jobs/board-payload";
import { loadBoard } from "@/lib/jobs/load-board";
import { applyCountryDefault } from "@/lib/search/geo-query";
import { deriveListing } from "@/lib/search/listing-view";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/parse-query";

type JobListingProps = { searchParams: Promise<RawSearchParams> };

// The first paint for any URL is still made here, on the server: parse the URL,
// derive the whole screen from the cached board, send finished HTML. A copied
// link renders the same on someone else's machine, with JavaScript off, and to a
// crawler.
//
// What is sent down is the DERIVED view -- one page of rows and the counted
// facet options -- not the board. The board is 108KB and there are thousands of
// these URLs; inlining it into each of them would put the whole thing in every
// document and none of them would share a byte. It arrives once, separately,
// from /api/board, and boardVersion is the digest that names which copy.
//
// COUNTRY IS THE ONE THING THIS RENDER VARIES ON
//
// searchParams, the geo header and the cookie are all request-time APIs, so
// this component is dynamic and sits inside the page's <Suspense>. Only the
// third of those is new, and it resolves to a country BEFORE anything is
// derived: applyCountryDefault turns "this request came from Japan" into
// "?country=JP", and from that line on the render is a pure function of a query
// exactly like every other. Nothing downstream can tell the difference between
// a country that was detected and one that was typed, which is what keeps one
// implementation serving both.
export async function JobListing({ searchParams }: JobListingProps) {
  const board = await loadBoard();
  const asked = parseJobQuery(await searchParams);
  const fallback = await countryDefault(openCountries(board));
  const query = applyCountryDefault(asked, fallback);

  return (
    <Listing
      boardVersion={await boardVersion()}
      countryDefault={fallback}
      initialQuery={query}
      initialView={deriveListing(board, query)}
    />
  );
}
