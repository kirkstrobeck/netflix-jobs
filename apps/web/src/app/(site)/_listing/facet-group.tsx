"use client";

import { useId, useState, type ReactNode } from "react";

import { FacetOptions } from "@/app/(site)/_listing/facet-options";
import { useQueryNavigation } from "@/app/(site)/_listing/use-query-navigation";
import { matchOptions, type FacetOption } from "@/lib/search/facet-counts";
import { toggleFacet, type FacetKey, type JobQuery } from "@/lib/search/job-query";

type FacetGroupProps = {
  facetKey: FacetKey;
  legend: string;
  options: FacetOption[];
  /** The group's name as a plural noun: "teams", "work types", "countries". */
  plural: string;
  query: JobQuery;
  /**
   * What ticking a box does, when it is not just "toggle this value".
   *
   * The country group passes one, because ticking a country also has to clear
   * the offices inside it and set the everywhere flag -- see toggleCountry.
   */
  onToggle?: (value: string) => void;
  /** Rendered under one option; the country group hangs its offices here. */
  renderNested?: (option: FacetOption) => ReactNode;
  /** Rendered last inside the fieldset, under the options. */
  children?: ReactNode;
};

// A search bar over the options rather than a dropdown of all of them: there are
// 21 countries and 31 teams, and the useful interaction is "type Tokyo", not
// "scroll".
//
// The search text is local state and never reaches the URL -- it narrows which
// options are on screen, it does not filter any jobs. Only ticking a box does
// that, and that goes through the URL like everything else.
export function FacetGroup({
  facetKey,
  legend,
  options,
  plural,
  query,
  onToggle,
  renderNested,
  children,
}: FacetGroupProps) {
  const [search, setSearch] = useState("");
  const navigate = useQueryNavigation();
  const searchId = useId();
  const visible = matchOptions(options, search);
  const selected = query[facetKey].length;
  // Built from the same noun the disclosure below uses, so "Search teams" and
  // "Show all 31 teams" cannot drift into naming the same group two ways.
  const searchLabel = `Search ${plural}`;
  const toggle =
    onToggle ?? ((value: string) => navigate(toggleFacet(query, facetKey, value)));

  return (
    <fieldset className="facet">
      <legend className="facet__legend">
        {legend}
        {/* A live tally beside the group's name: the one number in this facet
            that moves on every click, so the click is never in doubt. */}
        {selected > 0 ? (
          <span className="facet__tally">{selected} selected</span>
        ) : null}
      </legend>

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
        <FacetOptions
          onToggle={toggle}
          options={visible}
          plural={plural}
          renderNested={renderNested}
        />
      )}

      {/* Only while this facet is filtering -- which is exactly when its own
          counts stop moving and start looking broken. */}
      {selected > 0 ? (
        <p className="facet__pinned">
          Counts ignore this filter so you can widen it. Every other filter is
          applied.
        </p>
      ) : null}

      {children}
    </fieldset>
  );
}
