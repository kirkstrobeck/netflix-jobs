import type { Nearest } from "@/app/(site)/_listing/use-nearest";
import type { FacetOption } from "@/lib/search/facet-counts";
import type { JobQuery } from "@/lib/search/job-query";
import type { HeadingPlace } from "@/lib/search/listing-heading";

/**
 * Which precision tier the heading gets to speak at, given what is known right
 * now. Finest first: a real position beats a country, always.
 *
 * COUNTRY IS SERVER-SAFE, DEVICE IS NOT, AND THAT IS THE WHOLE SPLIT
 *
 * The country comes off `query.country`, which is the URL -- the one dimension
 * the listing already varies on. So the country tier renders on the server, is
 * in the prerendered HTML, is the same for everyone sharing the link, and costs
 * no second cache key. Nothing new became dynamic to make the heading name a
 * place.
 *
 * The device tier cannot be any of those things: a position is per visitor, not
 * in the URL, and arrives seconds after the page if it arrives at all. It is
 * therefore a refinement applied after paint, and it cannot shift the shell --
 * `nearest.buckets` is null on the first client render exactly as it was on the
 * server, so hydration matches and the heading only changes once a real fix has
 * landed.
 *
 * The country NAME is read off the facet options rather than fetched: the panel
 * has already labelled every country to draw its checkboxes, so the display name
 * is in the view both on the server and on the client, from the same board, with
 * nothing new to plumb and no second spelling to drift.
 */
/**
 * The code travels with the label because the heading's grammar needs it: four
 * of the board's countries take "the" and the rest do not, and that is a
 * property of the country rather than of the string it is spelled with.
 *
 * A country with no label in the facet list is dropped. That is the fail-closed
 * path for /api/where: the facets only name countries this board hires in, so a
 * request placed in a country with no roles has nothing to be called here and
 * the heading stays plain rather than naming somewhere the board has never
 * heard of.
 */
function named(
  countries: FacetOption[],
  code: string,
  precision: "country" | "request",
): HeadingPlace | null {
  const name = countries.find((option) => option.value === code)?.label;

  return name ? { precision, code, name } : null;
}

export function headingPlace(
  query: JobQuery,
  countries: FacetOption[],
  nearest: Nearest,
  where: string | null,
): HeadingPlace | null {
  if (query.sort !== "nearest") {
    return null;
  }

  // A real position. `place` is null until a geocoder is configured, and the
  // heading says "nearest to you" rather than inventing a name for it.
  if (nearest.buckets) {
    return { precision: "device", name: nearest.place };
  }

  // Exactly one country, or none. Two ticked countries is a list that is about
  // both, and naming one of them in the heading would be a claim about an
  // ordering that is not happening.
  const [code, ...rest] = query.country;

  if (rest.length > 0) {
    return null;
  }

  if (code) {
    return named(countries, code, "country");
  }

  // THE COUNTRY IS IN THE URL, OR IT IS NOT A FILTER.
  //
  // Past this line the visitor has NOT answered the country question -- they
  // cleared it, or they arrived on a link that says everywhere -- so what
  // follows can only name a place, never narrow the list. `where` comes from
  // GET /api/where after paint, and the tier it produces is a different
  // sentence for exactly that reason: see listing-heading.ts.
  //
  // An office ticked without its country is still an answer to "where", so the
  // guess stays quiet there too.
  if (query.site.length > 0 || !where) {
    return null;
  }

  return named(countries, where, "request");
}
