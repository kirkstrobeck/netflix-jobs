import localFont from "next/font/local";

import "@/app/(site)/job-shell.css";
import "@/app/(site)/site-masthead.css";

// Netflix Sans already shipped in public/fonts but nothing declared it. Loading it
// through next/font/local (rather than a hand-written @font-face) is what keeps the
// swap from reflowing: `adjustFontFallback` emits a companion @font-face for Arial
// with size-adjust/ascent-override derived from the real font metrics, so the
// fallback occupies the same space as the webfont.
//
// It is declared in this layout, not a shared module, because next/font only emits
// a <link rel="preload"> for fonts whose localFont() call sits in a page or layout
// file. Here rather than the root layout so it still stops at the (site) boundary:
// /foo is a bare prototype route and has no business preloading three webfonts.
const netflixSans = localFont({
  src: [
    {
      path: "../../../public/fonts/NetflixSans_W_Rg.013xgptcmkvot.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/NetflixSans_W_Md.9d31b8ed.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/NetflixSans_W_Bd.437347b6.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["Arial", "Helvetica", "sans-serif"],
  variable: "--font-netflix-sans",
  preload: true,
});

// WHY THE CHROME ARRIVES AS SLOTS
//
// Both wordmarks link to the board, and on the board that link has to carry the
// visitor's facets or it throws them away. A layout cannot read them: layouts do
// not re-render on navigation, so Next never hands one search params -- and
// reading the request instead, with headers(), would make this layout dynamic
// for EVERY route under it. Measured on `next start` 16.2.12: /jobs/JR42022
// currently answers `x-nextjs-prerender: 1` with the s-maxage from
// cache-headers.ts, and one dynamic read here would turn all 481 postings into
// postponed resumes, which Next serves `private, no-store` with that header list
// discarded. A link on a page that has no filters is not worth that.
//
// Parallel routes are the mechanism that is route-aware without being dynamic:
// @header/page.tsx and @footer/page.tsx match the listing and are handed its
// searchParams like any page, while every other route under (site) falls to the
// slots' default.tsx and renders the same chrome with nothing to carry. So the
// posting stays prerendered and the board's mark still points at the board.
type SiteLayoutProps = {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
};

// The standard shell: masthead, content, ambient footer band. It wraps the home
// page and every job posting, which is the whole point of the (site) group --
// the group adds no URL segment, so /jobs/JR41912 stays /jobs/JR41912 while the
// home page picks up the same chrome instead of hand-rolling its own.
//
// The glow lives inside <SiteFooter />, never here and never in a page. Anything
// that wants it gets it by being in this layout; that is the only way in.
export default function SiteLayout({ children, footer, header }: SiteLayoutProps) {
  return (
    <div className={`${netflixSans.className} job-page`}>
      {header}

      {/* No .shell here, and that is the whole of the full-bleed mechanism.
          <main> is a grid item of .job-page, so with no width cap on it, it
          stretches to the page's own inline size -- which excludes the
          scrollbar, because it is a layout box and not a viewport unit. The
          76rem column moved down to the elements that want a measure (the
          posting's article, the listing's body) and away from the one thing
          that wants to reach the edges, which is the masthead's divider. */}
      <main className="site-main" id="site-main">
        {children}
      </main>

      {/* After </main>, so the ambient band is strictly below every piece of page
          content. .job-page carries the opaque --surface behind the article, so
          nothing above can sit over moving pixels. */}
      {footer}
    </div>
  );
}
