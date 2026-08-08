import { formatLocation } from "@/lib/format/location";
import type { JobSummary } from "@/lib/jobs/job-summary";
import { filterJobs } from "@/lib/search/filter-jobs";
import { facetValues } from "@/lib/search/job-index";
import type { FacetKey, JobQuery } from "@/lib/search/job-query";

export type FacetOption = {
  value: string;
  label: string;
  count: number;
  selected: boolean;
};

// Locations are stored comma-joined with no spaces; every other facet is already
// readable. The stored string stays the value -- it is what the URL and the
// matcher use -- and only the label is prettied.
function labelFor(key: FacetKey, value: string): string {
  if (key === "location") {
    return formatLocation(value);
  }

  return value;
}

/**
 * Options for one facet, counted against every OTHER part of the query.
 *
 * Excluding the facet's own selections is what makes the list usable once
 * something in it is ticked: with them applied, every unticked option would
 * count zero and the visitor could only ever narrow. Counting with this facet
 * open means "Marketing (28)" answers "how many would I get if I added this",
 * which is the question ticking a box asks.
 *
 * Sorted by count, then alphabetically so equal counts have a stable order.
 * Selected options are NOT floated to the top: they keep their place so the list
 * does not reorder under the pointer as a box is ticked.
 */
export function facetOptions(
  jobs: JobSummary[],
  query: JobQuery,
  key: FacetKey,
): FacetOption[] {
  const pool = filterJobs(jobs, query, key);
  const counts = new Map<string, number>();

  pool.forEach((job) => {
    facetValues(job, key).forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  // A selected value whose count fell to zero still has to render, or the only
  // control that could clear it would vanish and the filter would be stuck on.
  query[key].forEach((value) => {
    if (!counts.has(value)) {
      counts.set(value, 0);
    }
  });

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labelFor(key, value),
      count,
      selected: query[key].includes(value),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// Client-side narrowing of a long option list -- the "search bar, not a dropdown
// of every value" part. Matches the readable label, since that is what is on
// screen, and the stored value, so a location can be found by the raw string.
export function matchOptions(options: FacetOption[], search: string): FacetOption[] {
  const needle = search.trim().toLowerCase();

  if (!needle) {
    return options;
  }

  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) ||
      option.value.toLowerCase().includes(needle),
  );
}
