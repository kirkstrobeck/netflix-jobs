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
export function headingPlace(
  query: JobQuery,
  countries: FacetOption[],
  nearest: Nearest,
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

  if (!code || rest.length > 0) {
    return null;
  }

  const name = countries.find((option) => option.value === code)?.label;

  // The code travels with the label because the heading's grammar needs it:
  // four of the board's countries take "the" and the rest do not, and that is a
  // property of the country rather than of the string it is spelled with.
  return name ? { precision: "country", code, name } : null;
}
