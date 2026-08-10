"use client";

import { QueryLink } from "@/app/(site)/_listing/query-link";
import { useCountryChoice } from "@/app/(site)/_listing/use-country-choice";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { appliedCount, isFiltered } from "@/lib/search/query-edits";

type FacetsHeadProps = {
  headingId: string;
  query: JobQuery;
  switchId: string;
};

/**
 * The line above the filters: what they are called, how many are on, and the
 * way out of them.
 *
 * Its own file because it is not layout the way the panel below it is. It is
 * the panel's CONTROL -- on a narrow screen the heading is the thing that opens
 * and shuts the groups -- plus the two readings of the query that have to agree
 * with what opening it will show. facets-panel.tsx underneath is a list of
 * groups in an argued order and holds no state at all.
 */
export function FacetsHead({ headingId, query, switchId }: FacetsHeadProps) {
  const choose = useCountryChoice();
  const applied = appliedCount(query);

  return (
    <div className="facets__head">
      {/* ONE "FILTERS", WRITTEN ONCE.

          There used to be two: an h2 that was the column heading on a wide
          screen, and a separate <label> that carried the same word on a
          narrow one, each hidden at the other's width. Two copies of a word
          in the DOM is a bug waiting for a stylesheet to be late -- with
          jobs-collapse.css missing or stale, nothing hides either of them and
          the panel reads "FILTERS" then "Filters5 applied", which is exactly
          what got screenshotted.

          So the heading is the toggle's face rather than its twin: the h2 is
          rendered at every width and the <label> lives INSIDE it -- valid,
          since a label is phrasing content -- wrapping the only copy of the
          word. Below the breakpoint that label grows a box and a chevron and
          becomes the control; above it, it is just the text of a heading. */}
      <div className="facets__title">
        <h2 className="facets__heading" id={headingId}>
          <label className="facets__toggle" htmlFor={switchId}>
            Filters
            {/* The chevron does not change the WORD, which is the point: a
                label that said "Show" then "Hide" would be an accessible name
                that moves under a screen reader while the control stays put.
                Open and shut is what the checkbox announces; this is that
                same fact drawn. */}
            <span aria-hidden="true" className="facets__chevron" />
          </label>
        </h2>

        {/* A sibling of the heading, not a run of text inside it, and its own
            block element rather than an inline span glued to the word.

            It is here for the case that would otherwise be an invisible
            filter: the panel is collapsed by default on a narrow screen even
            when filters are on, so a visitor could be looking at 19 of 481
            roles with the reason folded away. It counts every ticked box and
            every keyword, so the number matches what opening it will show --
            which is why it is now shown at BOTH widths rather than only the
            collapsed one.

            A small piece of state, not a peer of the heading: smaller, muted,
            and set on the baseline beside it. And because it is a separate
            block element, a missing stylesheet drops it onto its own line
            instead of welding it to the word above. */}
        {applied > 0 ? (
          <>
            {" "}
            <p className="facets__applied">{applied} applied</p>
          </>
        ) : null}
      </div>

      {/* A link, not a button: clearing filters is just the unfiltered URL,
          which is a bare `/`.

          It goes through useCountryChoice rather than plain navigate, and
          that is the whole of why clearing sticks. A bare `/` is also what a
          visitor who has never been asked lands on, so on the next load
          detection would answer the country question for them and put the
          country they just cleared straight back on -- the button would look
          like it had not worked. Choosing writes the cookie, the cookie says
          everywhere, and detection keeps its hands off. */}
      {isFiltered(query) ? (
        <QueryLink className="facets__clear" onFollow={choose} query={EMPTY_QUERY}>
          Clear all
        </QueryLink>
      ) : null}
    </div>
  );
}
