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
 *   device   a real position, so "nearest to" is finally a true preposition
 *
 * `device` carries a name that may be null. Naming the place needs reverse
 * geocoding, which this app does not have (see lib/geo/geocoder.ts), and a null
 * name is not a reason to invent one: it drops to "nearest to you", which is
 * true, unglamorous, and claims only what a position actually tells us.
 */
export type HeadingPlace =
  | { precision: "country"; code: string; name: string }
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

  if (place?.precision === "device") {
    return place.name ? `Open roles nearest to ${place.name}` : "Open roles nearest to you";
  }

  // Nearest is chosen and we know nothing about where the visitor is: no
  // country in the URL and no position from the device. The heading claims
  // nothing, and the offer below it is what asks for the missing half.
  return "Open roles";
}
