/**
 * A country code, or nothing. The only place a two-letter code is recognised.
 *
 * ISO-3166-1 alpha-2 and nothing else: not 'USA', not 'en-US', not 'XX ' with a
 * space, not the empty string a header sets when the edge could not place the
 * address. Anything that is not exactly two letters is not a country, and the
 * caller gets null rather than a value it will fail to match later -- an
 * unrecognised code would filter the listing down to nothing and look like an
 * empty board rather than like a failed lookup.
 */
export function countryCode(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";

  if (!/^[A-Za-z]{2}$/.test(value)) {
    return null;
  }

  return value.toUpperCase();
}
