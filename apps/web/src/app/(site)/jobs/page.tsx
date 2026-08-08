import type { Metadata } from "next";
import { Suspense } from "react";

import { JobListing } from "@/app/(site)/jobs/job-listing";
import { ListingSkeleton } from "@/app/(site)/jobs/listing-skeleton";
import type { RawSearchParams } from "@/lib/search/job-query";

import "@/app/(site)/jobs/jobs-listing.css";
import "@/app/(site)/jobs/jobs-pager.css";
import "@/app/(site)/jobs/jobs-facets.css";
import "@/app/(site)/jobs/jobs-options.css";
import "@/app/(site)/jobs/[jobid]/posted-badge.css";

export const metadata: Metadata = {
  title: "Open roles — Netflix Jobs",
  description: "Search open roles at Netflix by team, work type and location.",
};

type JobsPageProps = { searchParams: Promise<RawSearchParams> };

// searchParams is a request-time API, so everything downstream of it has to sit
// inside <Suspense> -- without one, Cache Components fails the route with
// "Uncached data was accessed outside of <Suspense>" rather than prerendering a
// shell. The heading above the boundary is therefore static, and the results and
// facets stream in.
//
// The promise is passed down rather than awaited here on purpose: awaiting it in
// this component would make the whole page dynamic, including the heading.
export default function JobsPage({ searchParams }: JobsPageProps) {
  return (
    <div className="listing">
      <header className="listing-hero">
        <p className="eyebrow">Netflix</p>
        <h1 className="listing-title">Open roles</h1>
      </header>

      <Suspense fallback={<ListingSkeleton />}>
        <JobListing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
