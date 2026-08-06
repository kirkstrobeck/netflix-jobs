import Image from "next/image";
import Link from "next/link";

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

type WordmarkProps = {
  className: string;
  // Above the fold in the masthead, below it in the footer. Docs are explicit
  // that `loading="eager"` is the tool for this rather than `preload`, which is
  // for a single LCP hero.
  loading: "eager" | "lazy";
};

// One component for both instances, because the accessible name is the part
// worth writing once. This is a link to the home page wrapping an image, and an
// image link with no accessible name is a genuine a11y failure -- so alt is
// "Netflix" and the sibling "Jobs" completes it, giving the link the name
// "Netflix Jobs" with no aria-label and no text duplicated for screen readers.
export function Wordmark({ className, loading }: WordmarkProps) {
  return (
    <Link className={className} href="/">
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
