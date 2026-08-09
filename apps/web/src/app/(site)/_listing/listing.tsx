"use client";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { Pagination } from "@/app/(site)/_listing/pagination";
import { ResultCount } from "@/app/(site)/_listing/result-count";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { SortControl } from "@/app/(site)/_listing/sort-control";
import { SortStatus } from "@/app/(site)/_listing/sort-status";
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
export function Listing({ boardVersion, initialQuery, initialView }: ListingProps) {
  const { query, view, draft, setDraft, navigate, nearest } = useListing(
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

            {/* Inside the header and after the heading, so it reads as "these
                roles, ordered like this" and lands on the same line. It is the
                only thing on this page that is a control rather than a filter,
                which is why it sits here and not in the facets panel. */}
            <SortControl onNearest={nearest.request} query={query} />
          </header>

          {/* Under the header rather than inside it: it is a sentence about
              what the list below is, and it appears and disappears, so putting
              it in the header would make that line change height. */}
          {query.sort === "nearest" ? <SortStatus status={nearest.status} /> : null}

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
