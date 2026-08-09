import { countryCode } from "@/lib/geo/country-code";
import { EVERYWHERE } from "@/lib/search/job-query";

/**
 * The visitor's own answer to the country question, remembered across visits.
 *
 * A cookie, and not localStorage, for one reason: the listing is rendered on
 * the server. A choice the server cannot see is a choice that arrives after
 * first paint, which means the page renders one country and then swaps to
 * another -- the flash this whole arrangement exists to avoid. The value is a
 * country code, so it is the same single dimension the server is already
 * allowed to vary on, reaching it by a second route.
 *
 * It is written by the browser (see rememberCountry) rather than by a Server
 * Action, because writing it is not worth a round trip and because with
 * JavaScript off there is nothing to remember: the URL carries the choice, and
 * the URL is authoritative over this in every case.
 */
export const COUNTRY_COOKIE = "nfj_country";

// A year. This is a preference, not a session -- somebody who filtered to Japan
// in March means it in September -- and it is one enum value about a job board,
// so there is nothing here worth expiring sooner to protect.
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The cookie as a list of country codes.
 *
 * Empty list plus `true` means the visitor chose EVERY country, which is not
 * the same as having no cookie at all -- the first must stop detection and the
 * second must not. Anything unparseable is treated as no cookie: a value that
 * arrived from an older spelling, or from someone editing it by hand, should
 * fall back to detection rather than filter the board to a country that is not
 * there.
 */
export function readCountryCookie(
  raw: string | null | undefined,
): { countries: string[] } | null {
  const value = raw?.trim() ?? "";

  if (value === EVERYWHERE) {
    return { countries: [] };
  }

  const codes = value
    .split(",")
    .map((entry) => countryCode(entry))
    .filter((code): code is string => code !== null);

  if (codes.length === 0 || codes.length !== value.split(",").length) {
    return null;
  }

  return { countries: [...new Set(codes)].sort((a, b) => a.localeCompare(b)) };
}

/** The cookie value for a chosen set of countries. Empty means everywhere. */
export function countryCookieValue(countries: string[]): string {
  if (countries.length === 0) {
    return EVERYWHERE;
  }

  return countries.join(",");
}

/**
 * Write the choice down, in the browser.
 *
 * Lax rather than Strict: this is a display preference, and a visitor arriving
 * from a link in a message should see the country they picked, not have it
 * reappear only on their second click. Path is the whole site because the job
 * detail pages link back to a listing that has to remember.
 */
export function rememberCountry(countries: string[]): void {
  const value = countryCookieValue(countries);

  document.cookie = `${COUNTRY_COOKIE}=${value}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}
