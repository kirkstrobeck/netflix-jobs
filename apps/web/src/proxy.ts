import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Canonicalize the request path so each page has one address instead of one per
// casing. Canonical is: static route segments lowercase, and the job code
// UPPERCASE -- AJRT30201, JR41912 -- because that is the form Netflix prints on
// the posting and the form all 481 rows are stored in.
//
// The previous version lowercased the WHOLE path. That was only defensible while
// the id was position_id, a bigint with no letters to lose. Against an
// alphanumeric code it destroys the key, so the code segment is now deliberately
// the one part that is not cased down.
//
// This stays pure string work: the proxy runs ahead of the app, possibly on a
// CDN, and the docs are explicit that it should not lean on shared modules. No
// database round trip happens here -- an unknown code redirects to its uppercase
// form and the page renders the 404.
const JOBS_SEGMENT = "jobs";

// split("/") on "/jobs/AJRT30201" yields ["", "jobs", "AJRT30201"], so the code
// is index 2 under a "jobs" root. Every other segment is static.
function canonicalSegment(segment: string, index: number, segments: string[]): string {
  const isJobCode = index === 2 && segments[1]?.toLowerCase() === JOBS_SEGMENT;

  if (isJobCode) {
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const canonical = canonicalPath(pathname);

  // The overwhelmingly common case: already canonical, so do nothing.
  if (canonical === pathname) {
    return NextResponse.next();
  }

  // clone() carries the query string across, so ?src=test survives the redirect.
  // Fragments never reach the server; the browser reapplies them to the target.
  const url = request.nextUrl.clone();
  url.pathname = canonical;

  // 308, not 307/302: permanent and method-preserving, so caches and crawlers
  // settle on the canonical URL.
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Excludes everything already correctly cased and hot on the critical path:
  // `_next/` covers the CSS and font chunks under /_next/static and
  // /_next/static/media, and the trailing extension rule covers public/ assets
  // (fonts, video, favicon.ico, icon.png). Only extensionless app routes are
  // left, so no font or stylesheet pays for a redirect check.
  matcher: ["/((?!_next/|.*\\.[\\w]+$).*)"],
};
