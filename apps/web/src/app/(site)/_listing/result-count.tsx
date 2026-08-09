import type { PageWindow } from "@/lib/search/paginate";

// Deliberately down here with the pagination rather than at the top of the page:
// the count is a fact about the list you have just read, not a headline to open
// with.
//
// aria-live, because filtering happens without a page load. A sighted visitor
// sees the list change; without this, a screen reader user gets no signal that
// ticking a box did anything at all. polite, so it waits for a pause rather than
// interrupting -- and the region is always in the DOM, since a live region added
// at the same moment as its text is not reliably announced.
export function ResultCount({ window }: { window: PageWindow }) {
  return (
    <p aria-live="polite" className="result-count">
      {window.total === 0
        ? "No matching roles"
        : `Showing ${window.from} thru ${window.to} of ${window.total} ${
            window.total === 1 ? "role" : "roles"
          }`}
    </p>
  );
}
