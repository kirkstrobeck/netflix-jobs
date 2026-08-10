import type { SiteCatalog } from "@/lib/jobs/board";
import type { JobSummary } from "@/lib/jobs/job-summary";
import { siteLabel } from "@/lib/jobs/site";
import { filterJobs } from "@/lib/search/filter-jobs";
import { facetValues } from "@/lib/search/job-index";
import type { FacetKey, JobQuery } from "@/lib/search/job-query";
import { SENIORITY_LABELS, type SeniorityLevel } from "@/lib/search/seniority";

export type FacetOption = {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  /**
   * The country code an option belongs to, on site options only.
   *
   * It is baked in here rather than looked up in the panel so the facet list is
   * self-describing: the components that draw the nested country/site tree, and
   * the toggles that keep the two in step, need to know which country an office
   * sits in and can read it off the option instead of carrying the site catalog
   * down beside every list.
   */
  group?: string;
};

// A code and a slug are not readable, so the label is the display name for the
// facet's own vocabulary: the country's name, and the office's name WITHIN its
// country, since a site option is only ever drawn nested under one.
function labelFor(key: FacetKey, value: string, catalog: SiteCatalog): string {
  if (key === "country") {
    return catalog.countries.get(value) ?? value;
  }

  if (key === "site") {
    const site = catalog.bySlug.get(value);

    return site ? siteLabel(site) : value;
  }

  // `senior` -> "Senior", `staff` -> "Staff and principal". A slug the table
  // does not hold shows as itself, which is the same answer an unknown country
  // code gets above: a `?level=` somebody typed by hand still renders as a
  // ticked box that can be unticked.
  if (key === "seniority") {
    return SENIORITY_LABELS[value as SeniorityLevel] ?? value;
  }

  return value;
}

function groupFor(key: FacetKey, value: string, catalog: SiteCatalog) {
  if (key !== "site") {
    return undefined;
  }

  return catalog.bySlug.get(value)?.country_code;
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
  catalog: SiteCatalog,
): FacetOption[] {
  const pool = filterJobs(jobs, query, catalog, key);
  const counts = new Map<string, number>();

  pool.forEach((job) => {
    facetValues(job, key, catalog).forEach((value) => {
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
      label: labelFor(key, value, catalog),
      count,
      selected: query[key].includes(value),
      group: groupFor(key, value, catalog),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// Client-side narrowing of a long option list -- the "search bar, not a dropdown
// of every value" part. Matches the readable label, since that is what is on
// screen, and the stored value, so a country can be found by its code.
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
