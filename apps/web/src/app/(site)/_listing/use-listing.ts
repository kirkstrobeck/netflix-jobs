"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useMemo, useState } from "react";

import { useBoard } from "@/app/(site)/_listing/use-board";
import { useNearest, type Nearest } from "@/app/(site)/_listing/use-nearest";
import { applyCountryDefault, type CountryDefault } from "@/lib/search/geo-query";
import { jobsHref, type JobQuery } from "@/lib/search/job-query";
import { deriveListing, type ListingView } from "@/lib/search/listing-view";
import { readSearchParams } from "@/lib/search/parse-query";

export type Listing = {
  query: JobQuery;
  view: ListingView;
  /** The half-typed keyword, applied to the view but never to the URL. */
  draft: string;
  setDraft: (value: string) => void;
  navigate: (query: JobQuery) => void;
  /** The distance island: its state, and the one call that starts it. */
  nearest: Nearest;
};

// The keyword box filters as it is typed, so the text has to reach the filter
// before it reaches the URL. It is not URL state -- nobody can link to a
// half-typed word, and the server has never seen it -- so it is folded in here
// as one more keyword rather than written anywhere. Pressing Add is what turns
// it into a chip, which IS a link.
//
// Page 1, because a preview that started on page 4 of a list that no longer has
// four pages is a blank screen.
function withDraft(query: JobQuery, draft: string): JobQuery {
  const value = draft.trim();

  if (!value) {
    return query;
  }

  return { ...query, keywords: [...query.keywords, value], page: 1 };
}

/**
 * The listing's state, and the one place that decides whether a change costs a
 * round trip.
 *
 * `initialView` is what the server already rendered for this URL. It stays on
 * screen until the board arrives, so there is no loading state and nothing
 * moves: deriveListing over the board reproduces it exactly, because it is the
 * same function over the same rows.
 */
export function useListing(
  initialQuery: JobQuery,
  initialView: ListingView,
  boardVersion: string,
  countryDefault: CountryDefault,
): Listing {
  const board = useBoard(boardVersion);
  const nearest = useNearest(initialQuery.sort);
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState("");

  // Back and forward. Next's patched pushState feeds the new URL into
  // useSearchParams, and popstate restores it the same way, so the address bar
  // is what gets read -- a popstate listener would be a second opinion about
  // what the URL says, and the two would eventually disagree.
  //
  // The country default is applied here as well as on the server, through the
  // same function. Pressing Back onto a URL with no country in it has to mean
  // what it meant the first time that URL was rendered -- otherwise the state
  // the visitor is going back to is not the state they came from, and the
  // listing silently widens from their country to every country.
  const fromUrl = useMemo(
    () =>
      applyCountryDefault(
        readSearchParams(new URLSearchParams(params.toString())),
        countryDefault,
      ),
    [countryDefault, params],
  );

  // Seeded from the URL as it was at mount, NOT from initialQuery: those two
  // agree on every real request, and seeding from the URL means that if they
  // ever did not, the server's reading of it -- the one that produced what is
  // already on screen -- is the one that wins.
  const [seen, setSeen] = useState(() => jobsHref(fromUrl));

  // Adjusted during render rather than in an effect. This is a change that
  // happened OUTSIDE React -- someone pressed Back -- so there is nothing to
  // synchronise and nothing to clean up; React re-runs this render before it
  // commits, instead of committing a stale frame and then correcting it.
  //
  // It is a no-op after our own pushState, because navigate() records the URL it
  // wrote. Only a URL we did not write gets adopted.
  const href = jobsHref(fromUrl);

  if (href !== seen) {
    setSeen(href);
    setQuery(fromUrl);
  }

  // Typing paints the input first and recomputes the list at lower priority, so
  // a keystroke is never waiting on 481 rows to be filtered. React keeps the
  // previous list on screen in the meantime and abandons it if another key
  // lands, which is what makes fast typing cost one filter pass, not one each.
  const previewQuery = useMemo(
    () => withDraft(query, draft),
    [query, draft],
  );
  const deferredQuery = useDeferredValue(previewQuery);

  // initialView is the server's render, which is ALWAYS newest -- the server has
  // no position and is never given one. So the moment rings arrive there is a
  // view the server could not have produced, and the board has to be in memory
  // for it: with no board there is nothing to re-sort, so the fallback stays the
  // newest list the server sent, which is exactly what the sort status says is
  // on screen.
  const view = useMemo(() => {
    if (!board) {
      return initialView;
    }

    return deriveListing(board, deferredQuery, nearest.buckets);
  }, [board, deferredQuery, initialView, nearest.buckets]);

  const navigate = useCallback(
    (next: JobQuery) => {
      // No board: the URL is still the only way to change anything, exactly as
      // it was before any of this. router.push, not a hard link, so the app
      // router still handles it.
      if (!board) {
        router.push(jobsHref(next), { scroll: false });
        return;
      }

      const url = jobsHref(next);

      setQuery(next);
      setSeen(url);
      // The native History API, which Next patches to keep usePathname and
      // useSearchParams in step without fetching anything. push, not replace,
      // so every filter change is a back-button step -- ticking a box is a
      // navigation a visitor expects to be able to undo.
      window.history.pushState(null, "", url);
    },
    [board, router],
  );

  return { query, view, draft, setDraft, navigate, nearest };
}
