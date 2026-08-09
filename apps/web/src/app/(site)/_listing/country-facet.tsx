"use client";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { OptionCount } from "@/app/(site)/_listing/option-count";
import { useCountryChoice } from "@/app/(site)/_listing/use-country-choice";
import type { FacetOption } from "@/lib/search/facet-counts";
import { toggleCountry, toggleSite } from "@/lib/search/geo-query";
import type { JobQuery } from "@/lib/search/job-query";

/**
 * Country first, offices under the country that was ticked.
 *
 * IT IS CALLED LOCATION, AND IT IS COUNTED BY COUNTRY
 *
 * The group's heading names the whole question -- where is the work -- and the
 * two depths inside it are how that question is answered, not two questions.
 * "Country" named the top level only, which made the offices under it look like
 * a second facet that had lost its own heading. There is deliberately no
 * heading over the nested offices for the same reason: they are the answer
 * continuing, not a new list starting.
 *
 * The URL is untouched by this. It still says `?country=US`, because a
 * parameter is a key that people have already shared and a heading is a label;
 * renaming the key would break every link that exists to buy a word.
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
};

// An office list of one is noise: it repeats the country's own count on a
// checkbox that cannot narrow anything. 17 of the 21 countries are in that
// position; the six that are not (the US with ten, Canada, Australia, Poland,
// Germany and Taiwan with two apiece) are the ones this is for.
const worthNesting = (options: FacetOption[]) => options.length > 1;

export function CountryFacet({ countries, sites, query }: CountryFacetProps) {
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
              <OptionCount count={site.count} />
            </label>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <FacetGroup
      facetKey="country"
      legend="Location"
      onToggle={(code) => choose(toggleCountry(query, code, sitesIn(code).map((o) => o.value)))}
      options={countries}
      plural="locations"
      query={query}
      renderNested={nested}
      singular="location"
    />
  );
}

/* WHERE THE "MATCHED TO YOUR LOCATION" NOTE WENT
 *
 * It was here, and it was necessary: a listing that quietly dropped from 481
 * roles to 19 because the request came from Seoul was indistinguishable from a
 * board that only had 19 roles, and that sentence was the only thing on the page
 * that could tell the difference.
 *
 * The filter is not quiet any more. It is in the address bar, it is a ticked box
 * in this list with its own count beside it, and Clear all is on the line above.
 * The note was scaffolding around an invisible filter, and the filter is now
 * visible by construction -- so what is left of the note is a sentence
 * describing a checkbox the visitor is already looking at.
 *
 * Keeping it had a price, which is the other half of why it is gone. Knowing
 * that a country was DETECTED rather than typed means reading the request's geo
 * header and the cookie during the render, and a render that varies on anything
 * outside the URL cannot be served from a shared cache. Deleting it is what
 * bought the listing its CDN caching back. See cache-headers.ts.
 */
