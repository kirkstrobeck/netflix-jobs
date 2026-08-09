"use client";

import { useId } from "react";

import { CountryFacet } from "@/app/(site)/_listing/country-facet";
import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { KeywordFacet } from "@/app/(site)/_listing/keyword-facet";
import { QueryLink } from "@/app/(site)/_listing/query-link";
import { useCountryChoice } from "@/app/(site)/_listing/use-country-choice";
import type { FacetOption } from "@/lib/search/facet-counts";
import {
  appliedCount,
  EMPTY_QUERY,
  isFiltered,
  type FacetKey,
  type JobQuery,
} from "@/lib/search/job-query";

// The options arrive counted. deriveListing does it once for all four groups,
// over the whole board, so the panel is a layout and the arithmetic has exactly
// one home -- the same one the server render uses.
//
// THE ORDER, WHICH IS WORK TYPE, KEYWORDS, LOCATION, TEAM
//
// Location led for a while, on the grounds that a country can arrive ALREADY
// TICKED and a filter that applied itself should be the first thing on the
// panel. That is still true and it is no longer the strongest claim on the top
// of the list: the country is in the address bar, ticked in this panel with its
// own count, and one line under a "Clear all" that undoes it. It does not need
// to be first to be visible.
//
// WORK TYPE IS FIRST, AND IT IS ABOVE KEYWORDS
//
// Asked for in those words, and it wins the top of the panel outright rather
// than the top of the checkbox groups. The reading where Keywords keeps first
// place because it is "a search box, not a filter" is a distinction the panel
// does not draw anywhere else: a keyword chip counts toward "3 applied", it
// clears with Clear all, and it narrows the list exactly as a ticked box does.
// If it is a filter for all of that, it is a filter for this too.
//
// It also happens to be the better panel. Work type is two values, so it is the
// one group that is complete on screen -- no search box worth using, no
// disclosure -- and for the 97 roles that are remote it half-answers the
// location question below it. Keywords is the control that rewards being found
// second: someone who arrives typing goes to it regardless of what is above it,
// and someone who does not is better served by being shown a choice than an
// empty field.
//
// `plural` and `singular` are the group's name as a noun, and the only place it
// is written: the option search's label and the disclosure that opens the rest
// of the list are both built from them.
const WORK_TYPE = {
  key: "workType" as FacetKey,
  legend: "Work type",
  plural: "work types",
  singular: "work type",
};
const TEAM = {
  key: "team" as FacetKey,
  legend: "Team",
  plural: "teams",
  singular: "team",
};

type FacetsPanelProps = {
  facets: Record<FacetKey, FacetOption[]>;
  query: JobQuery;
  draft: string;
  onDraft: (value: string) => void;
};

/**
 * The filters. A sidebar at 64rem and up; above the results and collapsed on
 * anything narrower.
 *
 * ONE SET OF CONTROLS, TWO SHAPES
 *
 * There is no second mobile copy of this markup -- a duplicated panel is two
 * sets of checkboxes that have to be kept saying the same thing, and the day
 * they disagree is the day a filter is applied by a control nobody can see. The
 * shape change is entirely in CSS: a checkbox whose :checked state opens the
 * panel, inside a media query that turns the whole mechanism off at the
 * breakpoint where the panel is always open anyway.
 *
 * NOT <details>. It is the obvious answer and it cannot be undone at a
 * breakpoint: openness is the `open` ATTRIBUTE, and no media query can force an
 * attribute on. A details-based panel would be shut on desktop until someone
 * clicked it, or open on mobile until someone shut it, and CSS could not settle
 * which. A checkbox's state is styleable, so the breakpoint can simply stop
 * reading it.
 */
export function FacetsPanel({
  facets,
  query,
  draft,
  onDraft,
}: FacetsPanelProps) {
  const choose = useCountryChoice();
  const switchId = useId();
  const headingId = useId();
  const applied = appliedCount(query);

  // aria-labelledby, pointing at the h2 below. It used to be a literal
  // aria-label, because the h2 was display: none on a narrow screen and a name
  // computed from a hidden element is no name at all. The h2 is now rendered at
  // both widths -- see below -- so the region takes its name from the heading
  // that is actually on screen, and the word is written down once.
  return (
    <aside aria-labelledby={headingId} className="facets">
      {/* First, and a sibling of the panel it opens: `:checked ~ .facets__panel`
          is the whole mechanism, and a sibling combinator only looks forward.

          Visually hidden rather than display: none, because it is the real
          control -- a <label> is not focusable and cannot be pressed with a
          keyboard, so the checkbox is what Tab reaches and Space toggles, and
          the label beside it is only its visible face. The focus ring is drawn
          on that face; see .facets__switch:focus-visible in jobs-facets.css. */}
      <input className="facets__switch visually-hidden" id={switchId} type="checkbox" />

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

      <div className="facets__panel">
        <FacetGroup
          facetKey={WORK_TYPE.key}
          legend={WORK_TYPE.legend}
          options={facets[WORK_TYPE.key]}
          plural={WORK_TYPE.plural}
          query={query}
          singular={WORK_TYPE.singular}
        />

        <KeywordFacet draft={draft} onDraft={onDraft} query={query} />

        <CountryFacet countries={facets.country} query={query} sites={facets.site} />

        <FacetGroup
          facetKey={TEAM.key}
          legend={TEAM.legend}
          options={facets[TEAM.key]}
          plural={TEAM.plural}
          query={query}
          singular={TEAM.singular}
        />
      </div>
    </aside>
  );
}
