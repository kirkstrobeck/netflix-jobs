import localFont from "next/font/local";

import { SiteFooter } from "@/app/jobs/site-footer";
import { SiteHeader } from "@/app/jobs/site-header";

import "@/app/jobs/job-shell.css";

// Netflix Sans already shipped in public/fonts but nothing declared it. Loading it
// through next/font/local (rather than a hand-written @font-face) is what keeps the
// swap from reflowing: `adjustFontFallback` emits a companion @font-face for Arial
// with size-adjust/ascent-override derived from the real font metrics, so the
// fallback occupies the same space as the webfont.
//
// It is declared in this layout, not a shared module, because next/font only emits
// a <link rel="preload"> for fonts whose localFont() call sits in a page or layout
// file. Keeping it here also scopes the font to /jobs, leaving the root layout —
// and the home page — untouched.
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

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${netflixSans.className} job-page`}>
      <SiteHeader />

      <main className="shell job-main" id="job-main">
        {children}
      </main>

      {/* After </main>, so the ambient band is strictly below every piece of job
          content. .job-page carries the opaque --surface behind the article, so
          nothing from the posting can sit over moving pixels. */}
      <SiteFooter />
    </div>
  );
}
