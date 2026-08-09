import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  COUNTRY_COOKIE,
  countryDefault,
  GEO_HEADER,
} from "@/lib/geo/country-default";
import { countryRedirect } from "@/lib/geo/country-redirect";

// TWO JOBS, IN ORDER: canonicalize the path, then make the URL admit which
// country the listing is about to be filtered by. Both happen here for the same
// reason -- this file runs BEFORE anything is rendered, so an answer given here
// is the first thing the browser hears rather than a correction to something it
// has already painted.

// Canonicalize the request path so each page has one address instead of one per
// casing. Canonical is: static route segments lowercase, and the job code
// UPPERCASE -- AJRT30201, JR41912 -- because that is the form Netflix prints on
// the posting and the form all 481 rows are stored in.
//
// An earlier version lowercased the WHOLE path. That was only defensible while
// the id was position_id, a bigint with no letters to lose. Against an
// alphanumeric code it destroys the key, so the code segment is deliberately the
// one part that is not cased down.
//
// Casing is now the only thing this file does. It used to also sniff the shape of
// the code segment and rewrite malformed ones to a second 404 route; that split
// is gone, and every miss -- absent code or junk alike -- falls through to the
// single 404 on /jobs/[jobid]. No database round trip happens here either.
const JOBS_SEGMENT = "jobs";

// split("/") on "/jobs/AJRT30201" yields ["", "jobs", "AJRT30201"], so the code
// is index 2 under a "jobs" root. Every other segment is static.
function canonicalSegment(segment: string, index: number, segments: string[]): string {
  if (index === 2 && segments[1]?.toLowerCase() === JOBS_SEGMENT) {
    return segment.toUpperCase();
  }

  return segment.toLowerCase();
}

function canonicalPath(pathname: string): string {
  const segments = pathname.split("/");

  return segments
    .map((segment, index) => canonicalSegment(segment, index, segments))
    .join("/");
}

// The listing, and the only path a country can apply to. /jobs/AJRT30201 shows
// one posting and is not filtered by anything.
const LISTING = "/";

// A redirect that is right for THIS visitor and wrong for the next one. Whatever
// a shared cache is told about the destination, the hop itself has to be worked
// out per request -- it is read off a cookie and an IP address, neither of which
// is in the URL that would be the cache key.
const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * The country hop: the URL is made to say what the listing is about to do,
 * before a byte of that listing exists.
 *
 * Everything it needs is on the request -- the cookie the visitor's own choice
 * was written to, and the country the edge read off their address -- so it
 * costs no round trip and reaches no database, which is what makes it safe to
 * run in front of every first paint. countryRedirect owns the precedence and
 * the fixed point; this owns getting the two strings out of the request.
 */
function countryHop(request: NextRequest): string | null {
  if (request.nextUrl.pathname !== LISTING) {
    return null;
  }

  return countryRedirect(
    request.nextUrl.searchParams,
    countryDefault(
      request.cookies.get(COUNTRY_COOKIE)?.value,
      request.headers.get(GEO_HEADER),
    ),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const canonical = canonicalPath(pathname);

  // clone() carries the query string across, so ?src=test survives the redirect.
  // Fragments never reach the server; the browser reapplies them to the target.
  const url = request.nextUrl.clone();

  if (canonical !== pathname) {
    url.pathname = canonical;

    // 308, not 307/302: permanent and method-preserving, so caches and crawlers
    // settle on the canonical URL. Casing is a property of the path and of
    // nothing else, so this answer is the same for everyone and is left
    // cacheable.
    return NextResponse.redirect(url, 308);
  }

  const search = countryHop(request);

  if (search) {
    url.search = search;

    // 307, NOT 308. The destination depends on where the request came from, so
    // a permanent redirect would have a browser remember one visitor's country
    // as the meaning of `/` -- and would have a crawler record it as the home
    // page's new address. Temporary keeps `/` the canonical URL and keeps the
    // hop revisitable.
    return NextResponse.redirect(url, { status: 307, headers: PRIVATE });
  }

  return NextResponse.next();
}

export const config = {
  // Excludes everything already correctly cased and hot on the critical path:
  // `_next/` covers the CSS and font chunks under /_next/static and
  // /_next/static/media, and the trailing extension rule covers public/ assets
  // (fonts, video, favicon.ico, icon.png). Only extensionless app routes are
  // left, so no font or stylesheet pays for a redirect check.
  matcher: ["/((?!_next/|.*\\.[\\w]+$).*)"],
};
