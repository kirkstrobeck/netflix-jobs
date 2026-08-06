import localFont from "next/font/local";

import { SiteFooter } from "@/app/(site)/site-footer";
import { SiteHeader } from "@/app/(site)/site-header";

import "@/app/(site)/job-shell.css";

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

// The standard shell: masthead, content, ambient footer band. It wraps the home
// page and every job posting, which is the whole point of the (site) group --
// the group adds no URL segment, so /jobs/JR41912 stays /jobs/JR41912 while the
// home page picks up the same chrome instead of hand-rolling its own.
//
// The glow lives inside <SiteFooter />, never here and never in a page. Anything
// that wants it gets it by being in this layout; that is the only way in.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${netflixSans.className} job-page`}>
      <SiteHeader />

      <main className="shell site-main" id="site-main">
        {children}
      </main>

      {/* After </main>, so the ambient band is strictly below every piece of page
          content. .job-page carries the opaque --surface behind the article, so
          nothing above can sit over moving pixels. */}
      <SiteFooter />
    </div>
  );
}
