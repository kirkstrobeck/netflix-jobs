import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { EMPTY_QUERY, jobsHref } from "@/lib/search/job-query";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/parse-query";

// The mark is Netflix's own artwork, converted from the supplied Illustrator
// EPS (%%HiResBoundingBox: 0 0 1427 383.3956). The EPS path operators carry
// straight across to SVG with no flip: the file's own `1 -1 scale
// 0 -383.396 translate` already maps path y=0 to the top of the page, which is
// exactly SVG's convention, so the coordinates are copied verbatim.
//
// ONE FILE, ONE TONE. The mark is #e50914 in both the masthead and the footer.
// There was briefly a white second rendering for the footer, on the grounds that
// red-on-red over the glow would vanish; that reasoning measured the wash at the
// band's BOTTOM edge, which is where the links sit, not the wordmark. The
// wordmark sits ~74% up the band, where the wash is ~1% alpha and red measures
// 4.29:1 -- the masthead's own number. wordmark.test.tsx pins that geometry.
//
// The tone is baked into the file rather than set in CSS because next/image
// renders an <img>, and an <img> is a replaced element: the document's `color`
// does not reach inside it, so `fill="currentColor"` would resolve against the
// image's own initial color, not the page's.
export const WORDMARK_RED = "/logo/netflix-wordmark.60c00df7.svg";

// The intrinsic box, not the rendered one. next/image uses these only to fix the
// aspect ratio so the browser reserves the right space before the file lands;
// .wordmark__mark in job-shell.css sets the height it actually paints at.
const INTRINSIC_WIDTH = 1427;
const INTRINSIC_HEIGHT = 383;

// The unfiltered board, spelled by the same function every facet toggle, pager
// link and role-page link is spelled by. It is "/" and not "/?": toSearchParams
// writes nothing for an empty query and jobsHref drops the separator with it, so
// a page with nothing ticked links to the bare address rather than to a second
// spelling of it. Written this way rather than as the literal so there is no
// second opinion about what the empty board's URL is.
const BOARD = jobsHref(EMPTY_QUERY);

type MarkProps = {
  className: string;
  href: string;
  // Above the fold in the masthead, below it in the footer. Docs are explicit
  // that `loading="eager"` is the tool for this rather than `preload`, which is
  // for a single LCP hero.
  loading: "eager" | "lazy";
};

type WordmarkProps = Omit<MarkProps, "href"> & {
  /**
   * The listing state this page is showing, if it is showing any.
   *
   * The mark goes home, and on the board "home" is the board the visitor is
   * already looking at -- so the href carries their facets rather than throwing
   * them away. A bare "/" is the worst available answer there: it drops the
   * filters AND lands on `/`, which proxy.ts re-answers with the country it
   * reads off the request, so the visitor arrives at a DIFFERENTLY filtered
   * board rather than an unfiltered one.
   *
   * Absent on the role page, and deliberately: a posting has no listing state
   * to preserve, which is the same reading facet-link.ts makes when it links
   * back to the board from one.
   */
  searchParams?: Promise<RawSearchParams>;
};

// The markup, written once. This is a link to the board wrapping an image, and
// an image link with no accessible name is a genuine a11y failure -- so alt is
// "Netflix" and the sibling "Jobs" completes it, giving the link the name
// "Netflix Jobs" with no aria-label and no text duplicated for screen readers.
function Mark({ className, href, loading }: MarkProps) {
  return (
    <Link className={className} href={href}>
      <Image
        alt="Netflix"
        className="wordmark__mark"
        height={INTRINSIC_HEIGHT}
        loading={loading}
        src={WORDMARK_RED}
        width={INTRINSIC_WIDTH}
      />
      <span className="wordmark__suffix">Jobs</span>
    </Link>
  );
}

// Server-rendered, so the href in the HTML is already right: no effect, no
// onClick, nothing for a crawler or a JavaScript-off visitor to miss. The query
// is READ here and spelled by jobsHref -- never assembled by hand -- so the
// mark, the facet checkboxes and the pager all produce byte-identical URLs for
// the same state and share one cache entry. Parsing on the way in is what makes
// that true of a hand-typed `?country=us&country=US` as well.
async function BoardMark({
  className,
  loading,
  searchParams,
}: Required<WordmarkProps>) {
  const query = parseJobQuery(await searchParams);

  return <Mark className={className} href={jobsHref(query)} loading={loading} />;
}

// One component for both instances, because the accessible name and the address
// are the parts worth writing once.
//
// searchParams is a request-time API, so the read has to sit behind a boundary
// -- and the boundary is HERE rather than around the masthead, so what streams
// in is one anchor and not the chrome. The fallback is the same mark at the
// same size pointing at the bare board, which is what a role page renders
// outright: nothing moves when the real href lands, and the no-JavaScript case
// degrades to exactly today's link rather than to a hole.
export function Wordmark({ className, loading, searchParams }: WordmarkProps) {
  if (!searchParams) {
    return <Mark className={className} href={BOARD} loading={loading} />;
  }

  return (
    <Suspense fallback={<Mark className={className} href={BOARD} loading={loading} />}>
      <BoardMark className={className} loading={loading} searchParams={searchParams} />
    </Suspense>
  );
}
