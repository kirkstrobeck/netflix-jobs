"use client";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { QueryLink } from "@/app/(site)/_listing/query-link";
import { useCountryChoice } from "@/app/(site)/_listing/use-country-choice";
import type { FacetOption } from "@/lib/search/facet-counts";
import {
  everyCountry,
  toggleCountry,
  toggleSite,
  type CountryDefault,
} from "@/lib/search/geo-query";
import type { JobQuery } from "@/lib/search/job-query";

/**
 * Country first, offices under the country that was ticked.
 *
 * The old panel had one flat list of 40 location strings, which meant that
 * asking for "roles in the US" was ticking Los Angeles and Los Gatos and New
 * York and Seattle and New Jersey and Washington DC and Burbank and Beckwourth
 * and USA-Remote and California-Remote, and getting it wrong by one. Country is
 * the question people actually arrive with, so it is the question the panel
 * asks; the offices are a refinement, and they appear only once a country makes
 * them relevant.
 *
 * WHERE REMOTE WENT
 *
 * Into the country it belongs to, as one more office in the list. 'USA -
 * Remote' is a United States role -- it is where the job is legally based, and
 * 95 of the 98 remote-only postings are that one scope -- so a visitor who
 * ticks United States has to get all 303 of them, remote included. Promoting
 * Remote to a top-level pseudo-country would take those 95 back out of the US
 * count and file them under something that is not a place, which is the same
 * "tick several boxes to mean one thing" problem in a new costume. The
 * orthogonal question, "remote anywhere", is already a first-class filter: it
 * is the Work type group, 104 roles, and it cuts across every country.
 */

type CountryFacetProps = {
  countries: FacetOption[];
  sites: FacetOption[];
  query: JobQuery;
  countryDefault: CountryDefault;
};

// An office list of one is noise: it repeats the country's own count on a
// checkbox that cannot narrow anything. 17 of the 21 countries are in that
// position; the six that are not (the US with ten, Canada, Australia, Poland,
// Germany and Taiwan with two apiece) are the ones this is for.
const worthNesting = (options: FacetOption[]) => options.length > 1;

export function CountryFacet({
  countries,
  sites,
  query,
  countryDefault,
}: CountryFacetProps) {
  // Every change made in here is an explicit answer to the country question, so
  // every change is written down. The cookie is the only part of this that
  // needs a browser: with JavaScript off the same click is a real navigation to
  // a URL that carries the country, and the URL outranks the cookie anyway.
  const choose = useCountryChoice();
  const selected = new Set(query.country);

  const sitesIn = (code: string) =>
    sites.filter((option) => option.group === code);

  const nested = (option: FacetOption) => {
    const options = sitesIn(option.value);

    if (!selected.has(option.value) || !worthNesting(options)) {
      return null;
    }

    return (
      // Its own labelled list rather than a nested fieldset: a fieldset inside
      // a fieldset inside a list item is three group announcements for one row
      // of checkboxes. The label names which country's offices these are, which
      // is the only thing a reader arriving here out of order needs.
      <ul aria-label={`Places in ${option.label}`} className="option__sites">
        {options.map((site) => (
          <li key={site.value}>
            <label className={site.selected ? "option option--on" : "option"}>
              <input
                checked={site.selected}
                className="option__box"
                onChange={() => choose(toggleSite(query, site.value, option.value))}
                type="checkbox"
              />
              <span className="option__label">{site.label}</span>
              <span aria-hidden="true" className="option__count">
                {site.count}
              </span>
            </label>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <FacetGroup
      facetKey="country"
      legend="Country"
      onToggle={(code) => choose(toggleCountry(query, code, sitesIn(code).map((o) => o.value)))}
      options={countries}
      plural="countries"
      query={query}
      renderNested={nested}
    >
      <DetectedNote
        countries={countries}
        onFollow={choose}
        query={query}
        source={countryDefault}
      />
    </FacetGroup>
  );
}

/**
 * Says out loud that a country was applied without being asked for.
 *
 * A listing that quietly drops from 481 roles to 19 because the request came
 * from Seoul is indistinguishable from a board that only has 19 roles. This is
 * the sentence that tells the difference, and the link beside it is the undo --
 * which, being a link to `?country=all`, is also the thing that stops detection
 * ever applying again on that URL.
 *
 * Shown only for a DETECTED country. One the visitor chose on an earlier visit
 * needs no explanation; it is their own setting coming back.
 */
function DetectedNote({
  countries,
  onFollow,
  query,
  source,
}: {
  countries: FacetOption[];
  onFollow: (query: JobQuery) => void;
  query: JobQuery;
  source: CountryDefault;
}) {
  const applied = source.countries[0];

  if (source.from !== "detected" || !applied) {
    return null;
  }

  // Only while the detected country is still the whole of the selection. The
  // moment anything else is ticked the sentence stops being true, and the panel
  // is describing the visitor's own choices back to them.
  if (query.country.length !== 1 || query.country[0] !== applied) {
    return null;
  }

  const name = countries.find((option) => option.value === applied)?.label ?? applied;

  return (
    <p className="facet__detected">
      {name} was matched to your location.{" "}
      <QueryLink
        className="facets__clear"
        onFollow={onFollow}
        query={everyCountry(query)}
      >
        Show every country
      </QueryLink>
    </p>
  );
}
