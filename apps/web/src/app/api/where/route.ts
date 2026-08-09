import { headers } from "next/headers";

import { detectedCountry, GEO_HEADER } from "@/lib/geo/country-default";

/**
 * The country the edge read off this request, and nothing else.
 *
 * WHY IT IS A ROUTE AND NOT PART OF THE RENDER
 *
 * The same argument /api/nearby makes, one tier coarser. The listing is allowed
 * to vary by exactly one thing -- the URL -- and reading a request header
 * during the render would make the HTML vary by a second, which cannot be
 * shared between two visitors and cannot be cached. Measured previously in this
 * repo: `/` moved from ƒ (dynamic) to ◐ (partial prerender) the moment
 * cookies() and headers() left it. Nothing here puts them back.
 *
 * So the page renders for everybody, and this answers a question the browser
 * asks afterwards. It costs no SSR, delays no paint, and adds no cache key.
 * It is also where a reverse geocoder lands when there is one: the shape of the
 * answer is already "a place, or nothing".
 *
 * IT IS NOT THE COUNTRY FILTER
 *
 * Nothing here touches the query, the cookie or the URL. The filter is settled
 * before the render by proxy.ts and is written into the address bar, which is
 * the rule this app is built on: a filter that is applied is a filter you can
 * see. Naming where we think somebody is must never re-apply a filter they just
 * cleared, or the invisible filter is back under a new name -- so this returns
 * a name and the caller is only allowed to say it.
 *
 * IT FAILS CLOSED
 *
 * No header, an unrecognisable header, localhost with no DEV_GEO_COUNTRY: all
 * of them are `{ "country": null }`, and the heading stays plain. A wrong
 * country is worse than no country, because a visitor cannot tell a guess from
 * a fact, and there is nothing in the interface that would correct it.
 */
export async function GET(): Promise<Response> {
  // headers() is a runtime API, so this can never be prerendered under Cache
  // Components -- which is exactly right: the answer is different for every
  // request and the same for none of them.
  const head = await headers();

  return Response.json(
    { country: detectedCountry(head.get(GEO_HEADER)) },
    {
      // private, and stored nowhere. The response is keyed on an IP address,
      // which is not in the URL a shared cache would key on -- so a CDN holding
      // this for sixty seconds would tell the next visitor they are wherever
      // the last one was.
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
