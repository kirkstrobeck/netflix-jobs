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
// THE ORDER, WHICH IS KEYWORDS, WORK TYPE, LOCATION, TEAM
//
// Location led for a while, on the grounds that a country can arrive ALREADY
// TICKED and a filter that applied itself should be the first thing on the
// panel. That is still true and it is no longer the strongest claim on the top
// of the list: the country is in the address bar, ticked in this panel with its
// own count, and one line under a "Clear all" that undoes it. It does not need
// to be first to be visible.
//
// What goes above it is the pair of questions that are asked before a place is.
// Keywords is what someone arrives typing. Work type is two values -- onsite or
// remote -- and for the 102 roles that are remote the location question is
// largely answered by asking it, which is a reason to ask it first rather than
// third.
//
// `plural` is the group's name as a noun, and the only place it is written: the
// option search's label and the disclosure that opens the rest of the list are
// both built from it.
const WORK_TYPE = { key: "workType" as FacetKey, legend: "Work type", plural: "work types" };
const TEAM = { key: "team" as FacetKey, legend: "Team", plural: "teams" };

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
  const applied = appliedCount(query);

  // aria-label rather than aria-labelledby pointing at the h2 below: the
  // heading is display: none on a narrow screen, where the toggle carries the
  // word instead, and a name computed from a hidden element is no name at all.
  // The region keeps the same name at both widths, and the accessibility tree
  // never holds "Filters" three times over.
  return (
    <aside aria-label="Filters" className="facets">
      {/* First, and a sibling of the panel it opens: `:checked ~ .facets__panel`
          is the whole mechanism, and a sibling combinator only looks forward.

          Visually hidden rather than display: none, because it is the real
          control -- a <label> is not focusable and cannot be pressed with a
          keyboard, so the checkbox is what Tab reaches and Space toggles, and
          the label beside it is only its visible face. The focus ring is drawn
          on that face; see .facets__switch:focus-visible in jobs-facets.css. */}
      <input className="facets__switch visually-hidden" id={switchId} type="checkbox" />

      <div className="facets__head">
        {/* The column's name where there are two columns. Below the breakpoint
            there is one column and this is not a column heading any more -- it
            is a label on a shut drawer -- so it goes and the toggle says the
            word instead. The outline that survives is the one that matters:
            h1 masthead, h2 "Open roles", h3 per role. */}
        <h2 className="facets__heading">Filters</h2>

        {/* The toggle's face. Its text is the checkbox's accessible name, so it
            says the same thing out loud as on screen -- which is why the word
            does not change to "Show"/"Hide" with the state. Open and shut is
            what the checkbox itself announces, and the chevron is that fact
            drawn.

            The applied tally is here for the one case that would otherwise be
            an invisible filter: the panel is collapsed by default even when
            filters are on, so a visitor could be looking at 19 of 481 roles
            with the reason folded away. It counts every ticked box and every
            keyword, so the number matches what opening it will show. */}
        <label className="facets__toggle" htmlFor={switchId}>
          Filters
          {applied > 0 ? (
            <span className="facets__applied">{applied} applied</span>
          ) : null}
          <span aria-hidden="true" className="facets__chevron" />
        </label>

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
        <KeywordFacet draft={draft} onDraft={onDraft} query={query} />

        <FacetGroup
          facetKey={WORK_TYPE.key}
          legend={WORK_TYPE.legend}
          options={facets[WORK_TYPE.key]}
          plural={WORK_TYPE.plural}
          query={query}
        />

        <CountryFacet countries={facets.country} query={query} sites={facets.site} />

        <FacetGroup
          facetKey={TEAM.key}
          legend={TEAM.legend}
          options={facets[TEAM.key]}
          plural={TEAM.plural}
          query={query}
        />
      </div>
    </aside>
  );
}
