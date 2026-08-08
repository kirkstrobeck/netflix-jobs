"use client";

import { useId, useState } from "react";

import { useQueryNavigation } from "@/app/(site)/jobs/use-query-navigation";
import { matchOptions, type FacetOption } from "@/lib/search/facet-counts";
import { toggleFacet, type FacetKey, type JobQuery } from "@/lib/search/job-query";

type FacetGroupProps = {
  facetKey: FacetKey;
  legend: string;
  options: FacetOption[];
  query: JobQuery;
  searchLabel: string;
};

// A search bar over the options rather than a dropdown of all of them: there are
// 40 locations, and the useful interaction is "type Tokyo", not "scroll".
//
// The search text is local state and never reaches the URL -- it narrows which
// options are on screen, it does not filter any jobs. Only ticking a box does
// that, and that goes through the URL like everything else.
export function FacetGroup({
  facetKey,
  legend,
  options,
  query,
  searchLabel,
}: FacetGroupProps) {
  const [search, setSearch] = useState("");
  const navigate = useQueryNavigation();
  const searchId = useId();
  const visible = matchOptions(options, search);

  return (
    <fieldset className="facet">
      <legend className="facet__legend">{legend}</legend>

      {/* A real <label>, visually hidden rather than absent: the legend names the
          group, and this names the input inside it. */}
      <label className="visually-hidden" htmlFor={searchId}>
        {searchLabel}
      </label>
      <input
        autoComplete="off"
        className="facet__search"
        id={searchId}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={searchLabel}
        type="search"
        value={search}
      />

      {visible.length === 0 ? (
        <p className="facet__none">No matches</p>
      ) : (
        <ul className="facet__options">
          {visible.map((option) => (
            <li key={option.value}>
              <label className="option">
                <input
                  checked={option.selected}
                  className="option__box"
                  onChange={() => navigate(toggleFacet(query, facetKey, option.value))}
                  type="checkbox"
                />
                <span className="option__label">{option.label}</span>
                {/* aria-hidden on the count: the label already names the option,
                    and "Engineering 96" read as one string is worse than the
                    checkbox's own name. The number is visual shorthand. */}
                <span aria-hidden="true" className="option__count">
                  {option.count}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
