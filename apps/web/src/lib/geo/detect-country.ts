import "server-only";

import { cookies, headers } from "next/headers";

import { COUNTRY_COOKIE, readCountryCookie } from "@/lib/geo/country-cookie";
import { countryCode } from "@/lib/geo/country-code";
import type { CountryDefault } from "@/lib/search/geo-query";

/**
 * The country the request came from, and the country the visitor last chose.
 *
 * Both are read here, in one place, and both come back as data rather than as a
 * rendered decision -- the rule about which of them wins lives in
 * applyCountryDefault, where the client can apply the same rule to the same
 * values after a Back button.
 */

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
 * most often -- and it is only ever a default: it applies to a first load and
 * nothing else, and the facet says out loud that it happened.
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
function overrideCountry(): string | null {
  const override = process.env.DEV_GEO_COUNTRY;

  if (override === undefined) {
    return DEFAULT_COUNTRY;
  }

  return countryCode(override);
}

async function detect(): Promise<string | null> {
  return countryCode((await headers()).get(GEO_HEADER)) ?? overrideCountry();
}

/**
 * What to apply when the URL has not answered the country question.
 *
 * `known` is the set of countries that actually have roles today. A detected
 * country is checked against it and dropped if it is not there: a visitor in
 * Kenya has their address read correctly and would land on a listing of zero
 * roles, which reads as a broken board rather than as a filter. A REMEMBERED
 * country is not checked -- they chose it, and a country they chose that has
 * nothing open this week is a fact they are entitled to see.
 */
export async function countryDefault(known: Set<string>): Promise<CountryDefault> {
  const jar = await cookies();
  const remembered = readCountryCookie(jar.get(COUNTRY_COOKIE)?.value);

  if (remembered) {
    return { countries: remembered.countries, from: "remembered" };
  }

  const detected = await detect();

  if (detected && known.has(detected)) {
    return { countries: [detected], from: "detected" };
  }

  return { countries: [], from: "detected" };
}
