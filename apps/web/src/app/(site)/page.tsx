import type { Metadata } from "next";
import { Suspense } from "react";

import { JobListing } from "@/app/(site)/_listing/job-listing";
import { ListingSkeleton } from "@/app/(site)/_listing/listing-skeleton";
import { HomeMasthead } from "@/app/(site)/home-masthead";
import type { RawSearchParams } from "@/lib/search/job-query";

import "@/app/(site)/home-masthead.css";
import "@/app/(site)/_listing/jobs-listing.css";
import "@/app/(site)/_listing/result-row.css";
import "@/app/(site)/_listing/jobs-pager.css";
import "@/app/(site)/_listing/jobs-facets.css";
import "@/app/(site)/_listing/jobs-options.css";
import "@/app/(site)/jobs/[jobid]/posted-badge.css";

export const metadata: Metadata = {
  // The root layout already titles the site; only the description is specific
  // to what this page now is.
  description: "Search open roles at Netflix by team, work type and location.",
};

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
    <div className="listing">
      <HomeMasthead />

      {/* h2, not h1: the masthead above owns the page's only h1, and this names
          the section under it. The "Netflix" eyebrow that used to sit here went
          with it -- a brand kicker directly beneath a full-bleed Netflix-red
          masthead was saying the same thing twice. */}
      <header className="listing-hero">
        <h2 className="listing-title">Open roles</h2>
      </header>

      <Suspense fallback={<ListingSkeleton />}>
        <JobListing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
