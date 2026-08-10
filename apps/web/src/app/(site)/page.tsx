import type { Metadata } from "next";
import localFont from "next/font/local";

import { BoardPage } from "@/app/(site)/_listing/board-page";
import { HomeMasthead } from "@/app/(site)/home-masthead";
import { JsonLd } from "@/lib/seo/json-ld";
import { netflixOrganization } from "@/lib/seo/organization";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/parse-query";

import "@/app/(site)/home-masthead.css";
import "@/app/(site)/_listing/jobs-listing.css";
import "@/app/(site)/_listing/result-row.css";
import "@/app/(site)/_listing/jobs-sort.css";
import "@/app/(site)/_listing/jobs-pager.css";
import "@/app/(site)/_listing/jobs-facets.css";
import "@/app/(site)/_listing/jobs-collapse.css";
import "@/app/(site)/_listing/jobs-options.css";
import "@/app/(site)/_listing/jobs-country.css";

export const metadata: Metadata = {
  // The root layout already titles the site; only the description is specific
  // to what this page now is.
  description: "Search open roles at Netflix by team, work type and location.",
};

// The masthead headline only, in the ultra-condensed bold cut. It is declared
// here and not in the (site) layout for the same reason the layout stops at the
// (site) boundary: next/font emits a <link rel="preload"> for the file, and the
// job detail route has no business fetching 41KB of display face it never sets.
// This is a page file, which is what makes that preload fire at all -- next/font
// only preloads fonts declared in a page or layout.
//
// Exposed as a variable rather than a className because the h1 lives two
// components down, inside <HomeMasthead>; threading the class through would put
// a font detail in that component's props. .masthead__title reads the variable.
// adjustFontFallback stays on: next derives size-adjust from this face's own
// metrics, so the Arial standing in during the swap is squeezed to roughly the
// condensed width and the headline does not reflow the listing under it.
const netflixSansUltraCondensed = localFont({
  src: [
    {
      path: "../../../public/fonts/NetflixSans_W_UCdBd.c6a7edc6.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
  variable: "--font-netflix-sans-ultra-condensed",
  preload: true,
});

type HomeProps = { searchParams: Promise<RawSearchParams> };

// AWAITED HERE, NOT STREAMED PAST.
//
// This used to hand the promise down into a <Suspense> and let the results
// arrive after the shell. That is what Cache Components asks for by default, and
// for this page it was the wrong trade: React streams a resolved boundary
// out-of-order -- the shell carries a ghost list, the real one lands in a
// <div hidden> at the end of the document, and an inline script moves it. So the
// filtered rows were IN the bytes and NOT on the screen until JavaScript ran.
//
// Awaiting it here removes the boundary, and with it the only reason the
// document was ever in two pieces: nothing in this tree suspends now, so React
// emits one complete document and the twenty rows and their count are in the
// markup a crawler, a reader-mode and a scriptless browser all see.
//
// What that costs is the prerendered shell -- the route is dynamic, since
// searchParams is request-time and there is no boundary left to defer it behind.
// The render it does per request is a cache read: BoardPage holds finished
// markup keyed on this exact query. See the root layout for the one line that
// makes awaiting a request-time API up here legal.
export default async function Home({ searchParams }: HomeProps) {
  // Parsed here rather than inside the cached component, because the PARSED
  // query is the cache key and parsing normalises: case, order and duplicates
  // all collapse, so two spellings of one screen share one entry.
  const query = parseJobQuery(await searchParams);

  return (
    <div className={`${netflixSansUltraCondensed.variable} listing`}>
      {/* Netflix, described once, here. Google's Organization guidance is to
          "place this information on your home page, or a single page that
          describes your organization" -- so not the root layout, which would
          repeat it on the 404 and on /foo.

          No ItemList. Google supports carousel/ItemList markup for four content
          types (course list, movie, recipe, restaurant) and JobPosting is not
          among them, and the JobPosting guidelines separately forbid job
          structured data on "pages intended to present a list of jobs". Markup
          nothing consumes on a page that is explicitly excluded is not a
          harmless extra -- it is a claim about a filtered, paginated list that
          changes with every query parameter. */}
      <JsonLd data={netflixOrganization()} />

      <HomeMasthead />

      <BoardPage query={query} />
    </div>
  );
}
