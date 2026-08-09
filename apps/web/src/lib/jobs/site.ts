// One row of public.locations: a Netflix office, or a country-wide remote scope.
//
// Shaped exactly like the table (snake_case, `is_remote`) because it arrives
// straight off PostgREST and is handed to the client unchanged. See
// supabase/migrations/20260809160000_locations.sql for what each column
// promises -- in particular that a remote scope has no city, and that the slug
// is the site's identity while the region is only data about it.
export type Site = {
  slug: string;
  /** Null for a remote scope: a country is not a place inside itself. */
  city: string | null;
  region: string | null;
  /** ISO-3166-1 alpha-2, upper case. */
  country_code: string;
  country: string;
  is_remote: boolean;
  /** 'Los Gatos, California, United States' / 'Remote, United States'. */
  display_name: string;
};

export const SITE_COLUMNS = [
  "slug",
  "city",
  "region",
  "country_code",
  "country",
  "is_remote",
  "display_name",
].join(",");

/**
 * A site's name WITHIN its country.
 *
 * The facet never shows a site on its own -- it is always nested under the
 * country that was ticked to reveal it -- so `display_name` would repeat that
 * country on every row: "Los Gatos, California, United States" under a heading
 * that already says United States, ten times over. The country is dropped and
 * what is left is the part that distinguishes one option from its siblings.
 *
 * A remote scope reads as "Remote" rather than as a place, since that is what
 * distinguishes it from the offices listed beside it, and the region is kept
 * when there is one so 'Remote, California' does not collapse onto 'Remote'.
 */
export function siteLabel(site: Site): string {
  if (site.is_remote) {
    return site.region ? `Remote, ${site.region}` : "Remote";
  }

  // The database forbids a site without a city (locations_remote_shape_ck), so
  // this is not a case that can arrive -- but the column is nullable for the
  // remote scopes above, so the type says it can, and a label is not the place
  // to find out. The slug is always there and always distinguishes the row.
  if (!site.city) {
    return site.slug;
  }

  // 'Singapore, Singapore' and 'Mumbai, Mumbai' are what the naive join gives
  // when the region only repeats the city.
  if (site.region && site.region !== site.city) {
    return `${site.city}, ${site.region}`;
  }

  return site.city;
}
