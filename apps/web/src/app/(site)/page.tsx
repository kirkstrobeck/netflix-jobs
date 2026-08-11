import type { Metadata } from "next";

import { BoardPage } from "@/app/(site)/_listing/board-page";
import { HomeMasthead } from "@/app/(site)/home-masthead";
import { JsonLd } from "@/lib/seo/json-ld";
import { netflixOrganization } from "@/lib/seo/organization";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/parse-query";

import "@/app/_ultra/ultra.css";
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

// WHY THIS ONE FACE IS NOT next/font.
//
// It used to be `localFont({..., preload: true})` here, on the stated ground that
// "next/font only preloads fonts declared in a page or layout", so declaring it
// in the listing's page file would keep the hint off the other two routes. That
// is not what the build does. Measured on 16.2.12: Turbopack writes
// next-font-manifest.json with the UNION of every face declared anywhere under
// (site) against EVERY entry in that subtree -- (site)/about/page,
// (site)/jobs/[jobid]/page and even the @header and @footer slots all listed
// this file -- and getPreloadableFonts() then faithfully emits a hint for it on
// all three pages. 41KB of display face preloaded at High priority on two routes
// that never set it. Hoisting the shared ultra.css out of the page files did not
// change the attribution, because it is a subtree union and not a chunk one.
//
// So the face is declared in CSS instead, in home-masthead.css, which only this
// page imports -- and a webfont is only fetched when a rule actually matches an
// element, so /about and /jobs/[jobid] now pay nothing at all for it, not even
// the request. The one thing next/font was buying that hand-written CSS is not,
// the metric-matched Arial fallback, is written out beside it with the exact
// override values next/font itself computed from this face; see that file.
//
// The preload has to be stated explicitly now, and this is the right place for
// it: React hoists a <link> rendered by a Server Component into <head>. It is
// worth stating, because this headline IS the listing's LCP element and dropping
// the hint measurably reflowed the rows under it.
const ULTRA_CONDENSED_FONT = "/fonts/NetflixSans_W_UCdBd.subset.woff2";

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
    <div className="listing">
      {/* crossOrigin is not decoration: a @font-face fetch is always made in
          CORS mode, so a preload without it is a second, separate request and
          the hint costs a round trip instead of saving one. */}
      <link
        as="font"
        crossOrigin="anonymous"
        href={ULTRA_CONDENSED_FONT}
        rel="preload"
        type="font/woff2"
      />
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
