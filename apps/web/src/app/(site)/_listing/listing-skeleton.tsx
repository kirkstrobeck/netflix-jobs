import { PAGE_SIZE } from "@/lib/search/paginate";

// The static shell Cache Components prerenders while the results stream in. It
// is a placeholder, not content, so it is hidden from assistive tech -- a screen
// reader announcing ten empty rows would be worse than silence.
//
// PAGE_SIZE rows, so the shell is the height the real list will be and the page
// does not jump when it arrives.
export function ListingSkeleton() {
  return (
    // "shell listing__body" is <Listing>'s own pair, not a lookalike: the
    // placeholder has to hold open the same column the real list arrives in, or
    // the page steps sideways when it streams.
    <div aria-hidden="true" className="shell listing__body">
      <div className="listing__results">
        <ol className="results">
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <li className="result result--ghost" key={i}>
              <span className="ghost ghost--title" />
            </li>
          ))}
        </ol>
      </div>

      <div className="facets">
        <span className="ghost ghost--panel" />
      </div>
    </div>
  );
}
