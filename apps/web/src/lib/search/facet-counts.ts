import type { SiteCatalog } from "@/lib/jobs/board";
import type { JobSummary } from "@/lib/jobs/job-summary";
import { siteLabel } from "@/lib/jobs/site";
import { filterJobs } from "@/lib/search/filter-jobs";
import { facetValues } from "@/lib/search/job-index";
import type { FacetKey, JobQuery } from "@/lib/search/job-query";
import {
  SENIORITY_LABELS,
  seniorityRank,
  type SeniorityLevel,
} from "@/lib/search/seniority-rank";

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

/**
 * The order one facet's options come back in, and the one facet that is not
 * sorted by count.
 *
 * ORDINAL VS NOMINAL, WHICH IS THE WHOLE RULE
 *
 * Seniority is a ladder. Its values have an order that exists before this board
 * does, every reader already knows it, and sorting it by count produced "Entry
 * level, Staff and principal, Mid level" -- which does not read as "these are
 * the popular ones", it reads as a list that has been shuffled. The rank comes
 * from seniority-rank.ts so that this comparator holds no opinion of its own.
 *
 * Every other facet is nominal. Canada is not more or less than Poland, Payments
 * is not more or less than Marketing, and there is no sequence to restore -- so
 * the useful order is the one that puts the biggest answers first, and they keep
 * it. Alphabetical breaks ties in both, so equal keys never shuffle between
 * renders.
 */
function ordering(key: FacetKey) {
  if (key === "seniority") {
    return (a: FacetOption, b: FacetOption) =>
      seniorityRank(a.value) - seniorityRank(b.value) || a.label.localeCompare(b.label);
  }

  return (a: FacetOption, b: FacetOption) =>
    b.count - a.count || a.label.localeCompare(b.label);
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
 * Sorted by `ordering` below -- by count for a nominal facet, by rank for the
 * one ordinal facet -- with the label breaking ties either way. Selected options
 * are NOT floated to the top: they keep their place so the list does not reorder
 * under the pointer as a box is ticked.
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
    .sort(ordering(key));
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
