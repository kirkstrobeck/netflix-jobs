import type { SortOrder } from "@/lib/search/sort-order";

/**
 * How precisely we know where the visitor is, and therefore what the heading is
 * allowed to claim.
 *
 * THE GRAMMAR HAS TO BE TRUE AT THE TIER
 *
 * "Open roles nearest to the United States" is nonsense, and it is exactly what
 * you get by writing one sentence and pouring whatever precision you happen to
 * have into it. A country is not a point, so nothing can be "nearest to" it. So
 * each tier gets its own wording rather than a shared template:
 *
 *   country  the country is stated AS a country -- the list is the roles in it
 *   request  the country the edge read off the request, which filters NOTHING
 *   device   a real position, so "nearest to" is finally a true preposition
 *
 * `request` is the tier that exists because the other two leave a hole: a
 * visitor who clears the country filter and asks for Nearest has answered
 * "everywhere" and given us no position, so neither of the other tiers can
 * speak and the heading falls back to a bare "Open roles".
 *
 * Its wording is deliberately NOT the country tier's. "Open roles in the United
 * States" over an unfiltered list of 481 roles in twenty-one countries is a
 * phantom filter -- worse than an invisible one, because the visitor can read
 * it and believe it. So the sentence says who is in the country rather than
 * what is: the subject is the visitor, and nothing about the list is claimed.
 *
 * `device` carries a name that may be null. Naming the place needs reverse
 * geocoding, which this app does not have (see lib/geo/geocoder.ts), and a null
 * name is not a reason to invent one: it drops to "nearest to you", which is
 * true, unglamorous, and claims only what a position actually tells us.
 */
export type HeadingPlace =
  | { precision: "country"; code: string; name: string }
  | { precision: "request"; code: string; name: string }
  | { precision: "device"; name: string | null };

/**
 * The four countries on this board whose names take a definite article.
 *
 * "Open roles in United States" is the kind of wrong that only appears once the
 * heading starts naming places, and it is wrong for exactly four of the
 * twenty-two countries the board hires in. Keyed on the ISO code rather than on
 * the display string, because the code is stable and the label is data: the
 * board spells this country "United States" today and "United States of
 * America" in some of its own location strings.
 *
 * A closed list is safe here for the same reason lib/seo/countries.ts is closed:
 * a country that is not in the board's table fails the structured-data gate, so
 * this cannot silently meet a country nobody has looked at. A country missing
 * from THIS list merely reads without an article, which is right for eighteen of
 * the twenty-two and never produces nonsense.
 */
const DEFINITE_ARTICLE = new Set(["US", "GB", "NL", "PH"]);

function countryPhrase(code: string, name: string): string {
  return DEFINITE_ARTICLE.has(code) ? `the ${name}` : name;
}

/**
 * The heading in two pieces: the part that is always shown, and a trailing
 * clause that the stylesheet is allowed to drop.
 *
 * ONLY THE `request` TIER HAS A SECOND PIECE, AND ONLY BECAUSE OF ITS WIDTH
 *
 * This heading is a compact uppercase label sharing a line with the sort
 * control, not a headline. Measured against the running page: the label's box
 * is 134px wide at a 320px viewport and 189px at 375px, so "Open roles — you
 * are in the United States" (387px) goes from one line to three and takes the
 * whole list down the page with it. From 640px up it is one line at every
 * width.
 *
 * The clause is therefore a separate element the media query in
 * jobs-listing.css can hide, rather than a string the component splits. The
 * alternative -- reserving three lines from first paint -- pays for a
 * refinement that may never arrive with a permanent gap above every phone's
 * results, and this tier is the one most likely to stay silent.
 *
 * "Open roles" is still written ONCE. It is the lead, and the clause is only
 * ever added to it, so a stylesheet that never loads shows the long sentence
 * rather than the word twice.
 */
export type HeadingParts = { lead: string; where: string | null };

export function headingParts(
  sort: SortOrder,
  place: HeadingPlace | null,
): HeadingParts {
  if (sort === "nearest" && place?.precision === "request") {
    return {
      lead: "Open roles",
      where: ` — you are in ${countryPhrase(place.code, place.name)}`,
    };
  }

  return { lead: listingHeading(sort, place), where: null };
}

/**
 * The results heading: one line that carries the sort and the place, so there
 * is no separate status sentence underneath restating what the list is.
 *
 * Newest is stated rather than left implicit. "Open roles" over a
 * newest-first list is a heading that declines to say the one thing it knows.
 */
export function listingHeading(sort: SortOrder, place: HeadingPlace | null): string {
  if (sort !== "nearest") {
    return "Newest open roles";
  }

  if (place?.precision === "country") {
    return `Open roles in ${countryPhrase(place.code, place.name)}`;
  }

  // "in" is the one word this must not use. The list is every open role, and
  // the country is a fact about the reader -- so the reader is the subject of
  // the clause and the list is left unclaimed. The dash rather than a comma
  // because these are two independent statements, not one sentence.
  if (place?.precision === "request") {
    return `Open roles — you are in ${countryPhrase(place.code, place.name)}`;
  }

  if (place?.precision === "device") {
    return place.name ? `Open roles nearest to ${place.name}` : "Open roles nearest to you";
  }

  // Nearest is chosen and we know nothing about where the visitor is: no
  // country in the URL, nothing from /api/where, and no position from the
  // device. The heading claims nothing, and the offer below it is what asks for
  // the missing half.
  return "Open roles";
}
