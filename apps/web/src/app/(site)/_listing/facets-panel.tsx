"use client";

import { CountryFacet } from "@/app/(site)/_listing/country-facet";
import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { KeywordFacet } from "@/app/(site)/_listing/keyword-facet";
import { QueryLink } from "@/app/(site)/_listing/query-link";
import { useCountryChoice } from "@/app/(site)/_listing/use-country-choice";
import type { FacetOption } from "@/lib/search/facet-counts";
import { everyCountry } from "@/lib/search/geo-query";
import { EMPTY_QUERY, isFiltered, type FacetKey, type JobQuery } from "@/lib/search/job-query";

// The options arrive counted. deriveListing does it once for all four groups,
// over the whole board, so the panel is a layout and the arithmetic has exactly
// one home -- the same one the server render uses.
//
// Country leads, and that is a change. Work type used to, on the grounds that
// onsite-or-remote is decided before a team is -- still true, but a country can
// now arrive ALREADY TICKED, matched to the request, and a filter that applied
// itself has to be the first thing on the panel rather than the third. Nobody
// should have to scroll to find out why the board is showing 303 roles instead
// of 481.
//
// `plural` is the group's name as a noun, and the only place it is written: the
// option search's label and the disclosure that opens the rest of the list are
// both built from it.
const GROUPS: { key: FacetKey; legend: string; plural: string }[] = [
  { key: "workType", legend: "Work type", plural: "work types" },
  { key: "team", legend: "Team", plural: "teams" },
];

type FacetsPanelProps = {
  facets: Record<FacetKey, FacetOption[]>;
  query: JobQuery;
  draft: string;
  onDraft: (value: string) => void;
};

export function FacetsPanel({
  facets,
  query,
  draft,
  onDraft,
}: FacetsPanelProps) {
  const choose = useCountryChoice();

  return (
    <aside aria-labelledby="filters-heading" className="facets">
      <div className="facets__head">
        <h2 className="facets__heading" id="filters-heading">
          Filters
        </h2>

        {/* A link, not a button: clearing filters is just the unfiltered URL.
            It clears to `?country=all` rather than to `/`, and goes through
            useCountryChoice like the country boxes do, because "clear" has to
            mean every country and stay meaning it. Clearing to a bare `/` would
            leave the country question unanswered, which is the one state that
            invites detection to answer it -- so the next reload would put the
            visitor's own country straight back on and the button would look
            like it had not worked. */}
        {isFiltered(query) ? (
          <QueryLink
            className="facets__clear"
            onFollow={choose}
            query={everyCountry(EMPTY_QUERY)}
          >
            Clear all
          </QueryLink>
        ) : null}
      </div>

      <KeywordFacet draft={draft} onDraft={onDraft} query={query} />

      <CountryFacet
        countries={facets.country}
        query={query}
        sites={facets.site}
      />

      {GROUPS.map((group) => (
        <FacetGroup
          facetKey={group.key}
          key={group.key}
          legend={group.legend}
          options={facets[group.key]}
          plural={group.plural}
          query={query}
        />
      ))}
    </aside>
  );
}
