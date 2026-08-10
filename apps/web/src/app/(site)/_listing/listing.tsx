"use client";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { LocationOffer } from "@/app/(site)/_listing/location-offer";
import { Pagination } from "@/app/(site)/_listing/pagination";
import { ResultCount } from "@/app/(site)/_listing/result-count";
import { RESULTS_ANCHOR } from "@/app/(site)/_listing/results-anchor";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { SortControl } from "@/app/(site)/_listing/sort-control";
import { useListing } from "@/app/(site)/_listing/use-listing";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { headingPlace } from "@/app/(site)/_listing/heading-place";
import type { JobQuery } from "@/lib/search/job-query";
import { listingHeading } from "@/lib/search/listing-heading";
import type { ListingView } from "@/lib/search/listing-view";

type ListingProps = {
  initialQuery: JobQuery;
  initialView: ListingView;
  boardVersion: string;
};

/**
 * The listing, rendered from whichever source is available.
 *
 * On the server and until the board lands, that is `initialView` -- so this
 * component's first render, in HTML, is byte for byte what the server component
 * above it used to emit. Nothing here is conditional on being in a browser, and
 * nothing waits for anything, which is what keeps the page correct with
 * JavaScript off and crawlable.
 *
 * Once the board is in memory the same markup is fed by deriveListing over it
 * instead, and the props stop being read. No swap, no remount, no flash: the
 * components are the same ones throughout, only their data changed hands.
 */
export function Listing({ boardVersion, initialQuery, initialView }: ListingProps) {
  const { query, view, draft, setDraft, navigate, nearest } = useListing(
    initialQuery,
    initialView,
    boardVersion,
  );

  // The URL's country on the server and on the first client render; the device
  // only once a fix has landed. See heading-place.ts for why that split is what
  // keeps the heading out of the cache key.
  const place = headingPlace(query, view.facets.country, nearest);
  const heading = listingHeading(place);

  return (
    <NavigateProvider value={navigate}>
      {/* The 76rem column, carried here rather than inherited from <main>:
          <main> gave it up so the masthead's divider could span the page, and
          this is the element below the masthead that wants a measure.
          ListingSkeleton carries the same pair, so the streamed list lands on
          exactly the column its placeholder held open. */}
      <div className="shell listing__body">
        <main className="listing__results">
          {/* Inside the results column, not above the body: it names this column,
              and being the column's first child is what puts it on the same line
              as "Filters" at the top of the other one.

              h2, not h1 -- the masthead owns the page's only h1. */}
          <header className="listing-hero">
            {/* The id is what every page link ends in, so changing page puts
                this line at the top of the viewport instead of leaving the
                visitor at the bottom of a list that has just been replaced.
                The offset is scroll-margin-block-start in jobs-listing.css.

                THE ID IS FIXED; THE TEXT IS NOT.

                The heading does NOT carry the sort. It is "Open roles", and the
                only thing that ever lengthens it is a device position that has
                actually landed -- "Open roles nearest to you". The sort lives in
                the control on this same line, which is a thing you can read AND
                change; a prefix restating it was a caption on the widget six
                inches to its right. Two things it is load-bearing for survive
                that:

                the id never changes with the wording, so #open-roles keeps
                landing here from every pager link; and the enable-location offer
                is NOT nested in here, because this is a document-outline heading
                and a button inside it would become part of the heading's text.
                The offer is a sibling, below.

                One text node, no spans. The heading used to end in a clause
                naming the visitor's country, split into its own element so a
                media query could drop it on a screen too narrow to hold it.
                That clause is gone -- the URL already carries the country and
                the facets panel already shows it ticked -- and with nothing
                left to drop, the element and its media query went with it. */}
            <h2 className="listing-title" id={RESULTS_ANCHOR}>
              {heading}
            </h2>

            {/* Inside the header and after the heading, so it reads as "these
                roles, ordered like this" and lands on the same line. It is the
                only thing on this page that is a control rather than a filter,
                which is why it sits here and not in the facets panel. */}
            <SortControl onNearest={nearest.request} query={query} />
          </header>

          {/* Under the header rather than inside it: it appears and disappears,
              so putting it in the header would make that line change height --
              and it holds a button, which must not end up inside an h2. */}
          {query.sort === "nearest" ? (
            <LocationOffer
              byCountry={place?.precision === "country"}
              nearest={nearest}
            />
          ) : null}

          <ResultList jobs={view.jobs} />

          <footer className="listing__foot">
            <ResultCount window={view.window} />
            <Pagination query={query} window={view.window} />
          </footer>
        </main>

        <FacetsPanel
          draft={draft}
          facets={view.facets}
          onDraft={setDraft}
          query={query}
        />
      </div>
    </NavigateProvider>
  );
}
