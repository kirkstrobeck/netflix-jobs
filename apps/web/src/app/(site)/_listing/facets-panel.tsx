"use client";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { KeywordFacet } from "@/app/(site)/_listing/keyword-facet";
import { QueryLink } from "@/app/(site)/_listing/query-link";
import type { FacetOption } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, isFiltered, type FacetKey, type JobQuery } from "@/lib/search/job-query";

// The options arrive counted. deriveListing does it once for all three groups,
// over the whole board, so the panel is a layout and the arithmetic has exactly
// one home -- the same one the server render uses.
const GROUPS: { key: FacetKey; legend: string; searchLabel: string }[] = [
  { key: "team", legend: "Team", searchLabel: "Search teams" },
  { key: "workType", legend: "Work type", searchLabel: "Search work types" },
  { key: "location", legend: "Location", searchLabel: "Search locations" },
];

type FacetsPanelProps = {
  facets: Record<FacetKey, FacetOption[]>;
  query: JobQuery;
  draft: string;
  onDraft: (value: string) => void;
};

export function FacetsPanel({ facets, query, draft, onDraft }: FacetsPanelProps) {
  return (
    <aside aria-labelledby="filters-heading" className="facets">
      <div className="facets__head">
        <h2 className="facets__heading" id="filters-heading">
          Filters
        </h2>

        {/* A link, not a button: clearing filters is just the unfiltered URL. */}
        {isFiltered(query) ? (
          <QueryLink className="facets__clear" query={EMPTY_QUERY}>
            Clear all
          </QueryLink>
        ) : null}
      </div>

      <KeywordFacet draft={draft} onDraft={onDraft} query={query} />

      {GROUPS.map((group) => (
        <FacetGroup
          facetKey={group.key}
          key={group.key}
          legend={group.legend}
          options={facets[group.key]}
          query={query}
          searchLabel={group.searchLabel}
        />
      ))}
    </aside>
  );
}
