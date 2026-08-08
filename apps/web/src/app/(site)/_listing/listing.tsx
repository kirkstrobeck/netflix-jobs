"use client";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { Pagination } from "@/app/(site)/_listing/pagination";
import { ResultCount } from "@/app/(site)/_listing/result-count";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { useListing } from "@/app/(site)/_listing/use-listing";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import type { JobQuery } from "@/lib/search/job-query";
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
export function Listing({ initialQuery, initialView, boardVersion }: ListingProps) {
  const { query, view, draft, setDraft, navigate } = useListing(
    initialQuery,
    initialView,
    boardVersion,
  );

  return (
    <NavigateProvider value={navigate}>
      <div className="listing__body">
        <main className="listing__results">
          {/* Inside the results column, not above the body: it names this column,
              and being the column's first child is what puts it on the same line
              as "Filters" at the top of the other one.

              h2, not h1 -- the masthead owns the page's only h1. */}
          <header className="listing-hero">
            <h2 className="listing-title">Open roles</h2>
          </header>

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
