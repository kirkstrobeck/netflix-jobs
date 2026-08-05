import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Canonicalize the path to lowercase so /Jobs/... and /JOBS/... resolve to the
// single lowercase address instead of becoming duplicate content.
//
// Lowercasing the WHOLE path is safe here because the only dynamic segment is a
// job id, and position_id is a bigint primary key: all 481 rows are 12 digits
// with zero non-digit characters, so no id can carry case to lose. If ids ever
// gain letters, this must narrow to the static prefix segments only.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const canonical = pathname.toLowerCase();

  // The overwhelmingly common case: already canonical, so do nothing. This is a
  // string compare and no allocation before the early return.
  if (canonical === pathname) {
    return NextResponse.next();
  }

  // clone() carries the query string across, so ?src=test survives the redirect.
  // Fragments never reach the server; the browser reapplies them to the target.
  const url = request.nextUrl.clone();
  url.pathname = canonical;

  // 308, not 307/302: permanent and method-preserving, so caches and crawlers
  // settle on the lowercase URL.
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
