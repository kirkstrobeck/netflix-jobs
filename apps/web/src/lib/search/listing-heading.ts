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
 * The results heading, which does not take the sort into its copy.
 *
 * THE SORT PREFIX IS GONE, AND THE ARGUMENT WENT WITH IT
 *
 * It used to be the first thing this function read: a newest list was headed
 * "Newest open roles", on the reasoning that a heading which declines to say the
 * one thing it knows is a wasted line. Two things were wrong with that. Newest
 * is the DEFAULT, so the prefix rode on every unsorted first load and the column
 * was headed by a claim about ordering before it was headed by what it holds.
 * And the sort is already on that same line, in a control that says which of the
 * two orders is on and can change it -- so the heading was captioning the widget
 * six inches to its right.
 *
 * `sort` is not a parameter any more, deliberately. Removing the branch would
 * have left the door open for the next mode to reintroduce a prefix of its own;
 * removing the argument means the heading cannot read the sort at all, in any
 * mode. listing-heading.test.ts pins the absence.
 *
 * What survives names a PLACE, not an order: a device fix that has actually
 * landed. `place` is only ever non-null once there is a position or a ticked
 * country -- see headingPlace -- so nothing here fires off the sort mode.
 */
export function listingHeading(place: HeadingPlace | null): string {
  if (place?.precision === "device") {
    return place.name ? `Open roles nearest to ${place.name}` : "Open roles nearest to you";
  }

  // Every remaining case: a ticked country, or nowhere known at all. The first
  // is the country the URL already carries and the facets panel already shows
  // ticked; the second has nothing to say in the first place. Both claim
  // nothing here, and the offer below is what asks for the missing half.
  return "Open roles";
}
