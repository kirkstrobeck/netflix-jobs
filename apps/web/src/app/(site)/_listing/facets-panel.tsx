"use client";

import { useId } from "react";

import { CountryFacet } from "@/app/(site)/_listing/country-facet";
import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { FacetsHead } from "@/app/(site)/_listing/facets-head";
import {
  BUSINESS_UNIT,
  SENIORITY,
  TEAM,
  WORK_TYPE,
} from "@/app/(site)/_listing/facet-groups";
import { KeywordFacet } from "@/app/(site)/_listing/keyword-facet";
import type { FacetOption } from "@/lib/search/facet-counts";
import type { FacetKey, JobQuery } from "@/lib/search/job-query";

// The options arrive counted. deriveListing does it once for every group, over
// the whole board, so the panel is a layout and the arithmetic has exactly one
// home -- the same one the server render uses.
//
// THE ORDER, WHICH IS WORK TYPE, KEYWORDS, LOCATION, SENIORITY, TEAM
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
// It also happens to be the better panel. Keywords is the control that rewards
// being found second: someone who arrives typing goes to it regardless of what
// is above it, and someone who does not is better served by being shown a
// choice than an empty field.
//
// Each group's own name and its own reason for sitting where it does are in
// facet-groups.ts, beside the group rather than above the component that draws
// all five.

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
  const switchId = useId();
  const headingId = useId();

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

      <FacetsHead headingId={headingId} query={query} switchId={switchId} />

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
          facetKey={SENIORITY.key}
          legend={SENIORITY.legend}
          options={facets[SENIORITY.key]}
          plural={SENIORITY.plural}
          query={query}
          singular={SENIORITY.singular}
        />

        <FacetGroup
          facetKey={TEAM.key}
          legend={TEAM.legend}
          options={facets[TEAM.key]}
          plural={TEAM.plural}
          query={query}
          singular={TEAM.singular}
        />

        <FacetGroup
          facetKey={BUSINESS_UNIT.key}
          legend={BUSINESS_UNIT.legend}
          options={facets[BUSINESS_UNIT.key]}
          plural={BUSINESS_UNIT.plural}
          query={query}
          singular={BUSINESS_UNIT.singular}
        />
      </div>
    </aside>
  );
}
