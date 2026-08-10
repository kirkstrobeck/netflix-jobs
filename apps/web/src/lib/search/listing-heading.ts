import type { SortOrder } from "@/lib/search/sort-order";

/**
 * How precisely we know where the visitor is, and therefore what the heading is
 * allowed to claim.
 *
 * THE HEADING NO LONGER NAMES A COUNTRY, AND THE TIERS OUTLIVED THAT
 *
 * Two of these tiers used to put a country in the heading -- "Open roles in the
 * United States" for a ticked country, "Open roles — you are in the United
 * States" for one the edge merely read off the request. Both are gone. The
 * board redirects to a country and filters by it, and the ticked box in the
 * facets panel is already on screen saying so, so the heading was restating a
 * filter the visitor can see. It now says "Open roles" in both cases.
 *
 * Two tiers remain, because the heading was never their only reader:
 *
 *   country  a ticked country -- LocationOffer asks for this tier by name
 *   device   a real position, so "nearest to" is finally a true preposition
 *
 * A third, `request`, is gone with the copy that motivated it: it carried the
 * country the edge read off the request, filtered nothing, and once the heading
 * stopped naming countries it read identically to no tier at all. The hook and
 * the GET /api/where route behind it went with it.
 *
 * `device` is the one tier that still speaks, and what it names is a position
 * rather than a country -- so it is not the callout that was removed. Its name
 * may be null: reverse geocoding is what would fill it, this app does not have
 * it (see lib/geo/geocoder.ts), and a null name is not a reason to invent one.
 * It drops to "nearest to you", which is true, unglamorous, and claims only
 * what a position actually tells us.
 */
export type HeadingPlace =
  | { precision: "country"; code: string; name: string }
  | { precision: "device"; name: string | null };

/**
 * The results heading: one line that carries the sort, so there is no separate
 * status sentence underneath restating what the list is.
 *
 * Newest is stated rather than left implicit. "Open roles" over a
 * newest-first list is a heading that declines to say the one thing it knows.
 */
export function listingHeading(sort: SortOrder, place: HeadingPlace | null): string {
  if (sort !== "nearest") {
    return "Newest open roles";
  }

  if (place?.precision === "device") {
    return place.name ? `Open roles nearest to ${place.name}` : "Open roles nearest to you";
  }

  // Every remaining case: a ticked country, or nowhere known at all. The first
  // is the country the URL already carries and the facets panel already shows
  // ticked; the second has nothing to say in the first place. Both claim
  // nothing here, and the offer below is what asks for the missing half.
  return "Open roles";
}
