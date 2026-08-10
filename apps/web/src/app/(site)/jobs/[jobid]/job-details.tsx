import type { ReactNode } from "react";

import { jobPlaces, type Place } from "@/lib/jobs/job-places";
import type { Site } from "@/lib/jobs/site";
import type { Job } from "@/lib/jobs/types";
import { facetHref, locationHref } from "@/lib/search/facet-link";

type Detail = { term: string; value: ReactNode };

/**
 * A value that is also a filter, as a link to that filter.
 *
 * A plain <a>, not next/link and not the listing's QueryLink. There is no
 * listing on this page to update in place, so there is nothing for a click
 * handler to do that the href does not already do -- which means this works
 * with JavaScript off, middle-clicks to a new tab, and copies as an address,
 * for free and by construction rather than by being careful.
 *
 * Not next/link for the reason the pager is not either: Link prefetches, and
 * these four point at the listing, which is the heaviest document on the site.
 * Four speculative fetches of it on every role page is a lot of bandwidth spent
 * on the chance that someone wanted the other Animation roles.
 *
 * The hidden "roles" is the same idiom the facet options use -- "206 roles" --
 * and it is what makes the accessible name a phrase rather than a bare value:
 * "Streaming" in a screen reader's list of links says nothing about where it
 * goes, and "Streaming roles" says all of it.
 */
function FilterLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="detail-list__link" href={href}>
      {label}
      <span className="visually-hidden"> roles</span>
    </a>
  );
}

/** One place, linked to its filter when the catalog knows the site. */
function Place({ place, catalog }: { place: Place; catalog: Site[] }) {
  if (!place.site) {
    return place.label;
  }

  return <FilterLink href={locationHref(place.site, catalog)} label={place.label} />;
}

/**
 * The location row: a real list when there is more than one place, and a bare
 * value when there is one.
 *
 * A REAL <ul>, NOT BULLETS DRAWN IN CSS.
 *
 * Several places used to be one run of text joined with ' · '. On screen that
 * reads as a list; to a screen reader it is a single value with punctuation in
 * it, and the one thing a listener most needs -- how many places this role is
 * open in -- has to be counted out of a sentence. A <ul> is announced as a list
 * with its item count before the first item is read. ::before content would put
 * the bullets back on screen and leave the semantics exactly as broken, which is
 * the trade this deliberately does not take.
 *
 * ONE PLACE GETS NO LIST, for the same reason a facet holding two options back
 * gets no disclosure: a list of one announces "list, 1 item" and then the item,
 * which is chrome charged for nothing. The row renders the value alone.
 *
 * The separator went with the run of text. It was a character in the markup
 * rather than a gap in a stylesheet, precisely so two adjacent links could not
 * read as 'Los AngelesLos Gatos' when the stylesheet was late -- the list
 * element carries that guarantee now, and carries it in the accessibility tree
 * as well as on screen.
 */
function Places({ places, catalog }: { places: Place[]; catalog: Site[] }) {
  if (places.length === 1) {
    return <Place catalog={catalog} place={places[0]} />;
  }

  return (
    <ul className="detail-places">
      {places.map((place) => (
        <li className="detail-places__item" key={place.label}>
          <Place catalog={catalog} place={place} />
        </li>
      ))}
    </ul>
  );
}

/**
 * WHICH VALUES ARE LINKS, AND WHICH ARE NOT
 *
 * Location, team, business unit and work type are the four the listing can be
 * filtered by, so those four are links to exactly that filter. The other two
 * rows are not, and the difference is the point: Job ID identifies this one
 * posting and filtering by it would return this page, and Department is a
 * column the listing has no facet for -- a link to a filter that does not exist
 * would be a link to the unfiltered board, which is a control that lies.
 *
 * A null column is text too. `job.team ?? job.department ?? "Netflix"` has
 * always filled the Team row with something, and only the first of those three
 * is a value the team facet holds; linking a fallback would send the visitor to
 * a filter matching no postings at all.
 */
function buildDetails(job: Job, catalog: Site[]): Detail[] {
  const places = jobPlaces(job, catalog);

  return [
    {
      term: "Team",
      value: job.team ? (
        <FilterLink href={facetHref("team", job.team)} label={job.team} />
      ) : (
        (job.department ?? "Netflix")
      ),
    },
    { term: "Department", value: job.department ?? "Not listed" },
    {
      term: "Business unit",
      value: job.business_unit ? (
        <FilterLink
          href={facetHref("businessUnit", job.business_unit)}
          label={job.business_unit}
        />
      ) : (
        "Not listed"
      ),
    },
    {
      term: places.length > 1 ? "Locations" : "Location",
      value:
        places.length > 0 ? <Places catalog={catalog} places={places} /> : "Not listed",
    },
    {
      term: "Work type",
      value: job.work_type ? (
        <FilterLink href={facetHref("workType", job.work_type)} label={job.work_type} />
      ) : (
        "Not listed"
      ),
    },
    { term: "Job ID", value: job.display_job_id ?? String(job.position_id) },
  ];
}

// Every row is always rendered, with "Not listed" standing in for a null column.
// A conditional row would change the card's height between jobs; a fixed set
// keeps the layout predictable and honest about missing data.
export function JobDetails({ job, catalog }: { job: Job; catalog: Site[] }) {
  return (
    <aside aria-labelledby="job-details-heading" className="job-details">
      <h2 className="section-heading section-heading--small" id="job-details-heading">
        Job details
      </h2>

      <dl className="detail-list">
        {buildDetails(job, catalog).map((detail) => (
          <div className="detail-list__row" key={detail.term}>
            <dt className="detail-list__term">{detail.term}</dt>
            <dd className="detail-list__value">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
