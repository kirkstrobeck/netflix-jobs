import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isJobId } from "@/lib/jobs/types";

// Two jobs, both pure string work over the path:
//
// 1. Canonicalize casing. Static route segments lowercase, and the job code
//    UPPERCASE -- AJRT30201, JR41912 -- because that is the form Netflix prints
//    on the posting and the form all 481 rows are stored in. An earlier version
//    lowercased the WHOLE path, which was only defensible while the id was
//    position_id, a bigint with no letters to lose.
//
// 2. Split the two 404s apart. A path whose code segment cannot be a job code at
//    all is rewritten to /jobs/invalid, whose not-found says nothing was ever
//    posted there. Well-formed-but-absent codes fall through to /jobs/[jobid],
//    whose not-found says the role closed. Choosing between those messages has
//    to happen before rendering, because a not-found boundary is per segment and
//    takes no props.
//
// No database round trip happens here, and isJobId is a pure regex with no state
// -- the docs' warning about shared modules in a proxy is about globals and
// singletons, not about duplicating a predicate until the two copies disagree.
const JOBS_SEGMENT = "jobs";
const INVALID_JOB_PATH = "/jobs/invalid";

// split("/") on "/jobs/AJRT30201" yields ["", "jobs", "AJRT30201"], so a job code
// is index 2 of exactly three segments under a "jobs" root. Anything deeper is
// not a job URL and is left to the router's own 404.
function jobCodeSegment(segments: string[]): string | null {
  const looksLikeJobUrl =
    segments.length === 3 && segments[1]?.toLowerCase() === JOBS_SEGMENT;

  if (looksLikeJobUrl) {
    return segments[2];
  }

  return null;
}

function canonicalSegment(segment: string, index: number, segments: string[]): string {
  if (index === 2 && segments[1]?.toLowerCase() === JOBS_SEGMENT) {
    return segment.toUpperCase();
  }

  return segment.toLowerCase();
}

function canonicalPath(segments: string[]): string {
  return segments
    .map((segment, index) => canonicalSegment(segment, index, segments))
    .join("/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/");
  const jobCode = jobCodeSegment(segments);

  // Malformed input is never canonicalized first. Redirecting /jobs/fuck-off to
  // /jobs/FUCK-OFF only to 404 it would spend a round trip dressing up a string
  // that can never name a posting, so it goes straight to the honest 404. The
  // rewrite keeps the typed URL in the address bar and the status at 404.
  if (jobCode !== null && !isJobId(jobCode)) {
    return NextResponse.rewrite(new URL(INVALID_JOB_PATH, request.url));
  }

  const canonical = canonicalPath(segments);

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
