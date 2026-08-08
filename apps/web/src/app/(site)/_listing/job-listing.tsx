import { Listing } from "@/app/(site)/_listing/listing";
import { boardVersion } from "@/lib/jobs/board-payload";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

type JobListingProps = { searchParams: Promise<RawSearchParams> };

// The first paint for any URL is still made here, on the server: parse the URL,
// derive the whole screen from the cached board, send finished HTML. A copied
// link renders the same on someone else's machine, with JavaScript off, and to a
// crawler.
//
// What is sent down is the DERIVED view -- one page of rows and the counted
// facet options -- not the board. The board is 143KB and there are thousands of
// these URLs; inlining it into each of them would put the whole thing in every
// document and none of them would share a byte. It arrives once, separately,
// from /api/board, and boardVersion is the digest that names which copy.
export async function JobListing({ searchParams }: JobListingProps) {
  const query = parseJobQuery(await searchParams);
  const jobs = await listJobSummaries();

  return (
    <Listing
      boardVersion={await boardVersion()}
      initialQuery={query}
      initialView={deriveListing(jobs, query)}
    />
  );
}
