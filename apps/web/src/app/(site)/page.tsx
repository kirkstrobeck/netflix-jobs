import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";

import { JobListing } from "@/app/(site)/_listing/job-listing";
import { ListingSkeleton } from "@/app/(site)/_listing/listing-skeleton";
import { HomeMasthead } from "@/app/(site)/home-masthead";
import { JsonLd } from "@/lib/seo/json-ld";
import { netflixOrganization } from "@/lib/seo/organization";
import type { RawSearchParams } from "@/lib/search/parse-query";

import "@/app/(site)/home-masthead.css";
import "@/app/(site)/_listing/jobs-listing.css";
import "@/app/(site)/_listing/result-row.css";
import "@/app/(site)/_listing/jobs-sort.css";
import "@/app/(site)/_listing/jobs-pager.css";
import "@/app/(site)/_listing/jobs-facets.css";
import "@/app/(site)/_listing/jobs-collapse.css";
import "@/app/(site)/_listing/jobs-options.css";
import "@/app/(site)/_listing/jobs-country.css";
import "@/app/(site)/jobs/[jobid]/posted-badge.css";

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

// searchParams is a request-time API, so everything downstream of it has to sit
// inside <Suspense> -- without one, Cache Components fails the route with
// "Uncached data was accessed outside of <Suspense>" rather than prerendering a
// shell. The heading above the boundary is therefore static, and the results and
// facets stream in.
//
// The promise is passed down rather than awaited here on purpose: awaiting it in
// this component would make the whole page dynamic, including the heading.
export default function Home({ searchParams }: HomeProps) {
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

      <Suspense fallback={<ListingSkeleton />}>
        <JobListing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
