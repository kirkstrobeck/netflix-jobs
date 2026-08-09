import { COUNTRY_COOKIE, readCountryCookie } from "@/lib/geo/country-cookie";
import { countryCode } from "@/lib/geo/country-code";
import { BOARD_COUNTRIES } from "@/lib/seo/countries";

/**
 * The country a request is owed when its URL has not named one.
 *
 * Pure, and deliberately so: it takes the two raw strings a request carries --
 * the cookie value and the geo header -- and returns codes. That is what lets
 * proxy.ts call it. The proxy runs before the render and has no `cookies()`, no
 * `headers()` and no data access; anything it needs has to arrive as an
 * argument or be a plain module.
 *
 * Nothing downstream calls this any more. The listing is now a pure function of
 * its URL, and this is the one place that decides what that URL should be.
 */

export { COUNTRY_COOKIE };

/**
 * Vercel's edge sets this on every request it forwards, before the function
 * runs; `NextRequest.geo` was removed in Next 15 and this header is what
 * replaced it (see docs/01-app/02-guides/upgrading/version-15.md). Another
 * platform's header would be one more `?? head.get(...)` below.
 *
 * A visitor CAN forge it against a deployment that is not behind that edge. The
 * worst they achieve is choosing which country their own listing defaults to,
 * which is a thing the URL lets anyone do anyway.
 */
export const GEO_HEADER = "x-vercel-ip-country";

/**
 * Where a request with no geography is assumed to be from.
 *
 * 303 of 481 roles are in the United States, so it is the answer that is right
 * most often -- and it is only ever a default: it applies to a URL that has not
 * answered the country question, and the answer it produces is written into the
 * address bar rather than applied behind it.
 */
export const DEFAULT_COUNTRY = "US";

/**
 * The dev override, and the reason this works on localhost.
 *
 * There is no edge in front of `next dev`, so the header is never there and the
 * detection path would be dead code on the only machine anyone develops on.
 * DEV_GEO_COUNTRY stands in for it: unset behaves like a US visitor, `JP`
 * behaves like a visitor in Tokyo, and anything that is not a country code at
 * all -- `DEV_GEO_COUNTRY=none` -- behaves like an edge that could not place
 * the address, which is the third case and the one that is otherwise
 * unreachable by hand.
 *
 * Not gated on NODE_ENV. A branch that only runs in production is a branch that
 * is first exercised in production; this way localhost runs the same function,
 * in the same order, and the only difference is which of its inputs is present.
 */
/**
 * Where the request appears to be from, or nothing. NO DEFAULT.
 *
 * This is the honest half of detection and it is deliberately separate from the
 * one below. `countryDefault` answers "which country should this URL be
 * filtered by", and its answer for a request it knows nothing about is the
 * United States -- a policy, and a defensible one, because 303 of 481 roles are
 * there and the answer is written into the address bar where it can be changed.
 *
 * This answers a different question: "where do we think this visitor IS". A
 * policy default is a wrong answer to that one. Saying "you are in the United
 * States" to somebody we cannot place is a claim about a person rather than a
 * choice about a list, so the absence of a signal returns null and the caller
 * says nothing at all. GET /api/where is that caller.
 *
 * DEV_GEO_COUNTRY is read here rather than in a second override of its own,
 * which is what keeps localhost exercising this path: unset means no signal,
 * `JP` means a visitor in Tokyo, and `none` -- anything that is not a country
 * code -- means an edge that could not place the address.
 */
export function detectedCountry(geo: string | null | undefined): string | null {
  return countryCode(geo) ?? countryCode(process.env.DEV_GEO_COUNTRY);
}

function detect(geo: string | null | undefined): string | null {
  const detected = detectedCountry(geo);

  if (detected) {
    return detected;
  }

  // Nothing was detected, and only now does the policy default apply. An
  // explicit DEV_GEO_COUNTRY that is not a country code is a deliberate "the
  // edge could not place this", so it does NOT fall through to the default --
  // that case is otherwise unreachable by hand.
  if (process.env.DEV_GEO_COUNTRY === undefined) {
    return DEFAULT_COUNTRY;
  }

  return null;
}

/**
 * Cookie beats geo header. URL beats both, and is not consulted here -- the
 * caller checks it first, because a URL that has answered is not owed a default
 * at all.
 *
 * An empty list means "apply nothing", and it is the answer to three different
 * questions: no signal at all, a visitor who chose EVERY country on an earlier
 * visit, and a country matched from an address that this board does not hire
 * in. All three end in the same place -- an unfiltered listing at an unfiltered
 * URL -- so they collapse to one return value rather than to a flag nobody
 * reads.
 *
 * A detected country is checked against the board's countries and dropped if it
 * is not one: a visitor in Kenya has their address read correctly and would
 * land on a listing of zero roles, which reads as a broken board rather than as
 * a filter. A REMEMBERED country is not checked -- they chose it, and a country
 * they chose that has nothing open this week is a fact they are entitled to
 * see.
 */
export function countryDefault(
  cookie: string | null | undefined,
  geo: string | null | undefined,
): string[] {
  const remembered = readCountryCookie(cookie);

  if (remembered) {
    return remembered.countries;
  }

  const detected = detect(geo);

  if (detected && BOARD_COUNTRIES.has(detected)) {
    return [detected];
  }

  return [];
}
