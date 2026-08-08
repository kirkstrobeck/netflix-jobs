import { FacetGroup } from "@/app/(site)/jobs/facet-group";
import { KeywordFacet } from "@/app/(site)/jobs/keyword-facet";
import type { JobSummary } from "@/lib/jobs/job-summary";
import { facetOptions } from "@/lib/search/facet-counts";
import {
  EMPTY_QUERY,
  isFiltered,
  jobsHref,
  type FacetKey,
  type JobQuery,
} from "@/lib/search/job-query";

// Counting happens here, on the server, over the whole cached board -- the
// client components receive finished options and never see the 481 rows.
const GROUPS: { key: FacetKey; legend: string; searchLabel: string }[] = [
  { key: "team", legend: "Team", searchLabel: "Search teams" },
  { key: "workType", legend: "Work type", searchLabel: "Search work types" },
  { key: "location", legend: "Location", searchLabel: "Search locations" },
];

export function FacetsPanel({ jobs, query }: { jobs: JobSummary[]; query: JobQuery }) {
  return (
    <aside aria-labelledby="filters-heading" className="facets">
      <div className="facets__head">
        <h2 className="facets__heading" id="filters-heading">
          Filters
        </h2>

        {/* A link, not a button: clearing filters is just the unfiltered URL. */}
        {isFiltered(query) ? (
          <a className="facets__clear" href={jobsHref(EMPTY_QUERY)}>
            Clear all
          </a>
        ) : null}
      </div>

      <KeywordFacet query={query} />

      {GROUPS.map((group) => (
        <FacetGroup
          facetKey={group.key}
          key={group.key}
          legend={group.legend}
          options={facetOptions(jobs, query, group.key)}
          query={query}
          searchLabel={group.searchLabel}
        />
      ))}
    </aside>
  );
}
