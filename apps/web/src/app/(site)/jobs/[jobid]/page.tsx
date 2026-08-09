import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobDescription } from "@/app/(site)/jobs/[jobid]/job-description";
import { JobDetails } from "@/app/(site)/jobs/[jobid]/job-details";
import { JobHeader } from "@/app/(site)/jobs/[jobid]/job-header";
import { getJob } from "@/lib/jobs/get-job";
import { listRecentJobIds } from "@/lib/jobs/job-ids";
import { listSites } from "@/lib/jobs/list-sites";
import { buildBreadcrumbs } from "@/lib/seo/breadcrumbs";
import { buildJobPosting } from "@/lib/seo/job-posting";
import { JsonLd } from "@/lib/seo/json-ld";

import "@/app/(site)/jobs/[jobid]/job-hero.css";
import "@/app/(site)/jobs/[jobid]/job-cta.css";
import "@/app/(site)/jobs/[jobid]/job-facts.css";
import "@/app/(site)/jobs/[jobid]/posted-badge.css";
import "@/app/(site)/jobs/[jobid]/job-details.css";
import "@/app/(site)/jobs/[jobid]/prose.css";

// The key must match the [jobid] route segment. `jobid` is the Netflix job code
// from jobs.display_job_id (AJRT30201, JR41912) -- the id printed on the posting
// -- not the position_id bigint, which stays the primary key but never appears
// in a URL.
type JobPageProps = { params: Promise<{ jobid: string }> };

// Required to return at least one param under `cacheComponents`. It also takes
// `params` out of the runtime-API set, which is what lets this page await it
// directly instead of hiding the whole job behind a <Suspense> fallback.
export async function generateStaticParams() {
  const ids = await listRecentJobIds();

  return ids.map((jobId) => ({ jobid: jobId }));
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { jobid: jobId } = await params;
  const job = await getJob(jobId);

  // notFound(), not a "Job not found" title. Throwing here takes the same branch
  // the page takes, so the tab title comes from the not-found boundary's own
  // <title>. The title this used to return was never rendered: once the page
  // calls notFound(), Next discards the page's metadata and fell back to the
  // layout's "Careers at Netflix", so the string was dead code that read as if
  // it worked.
  if (!job) {
    notFound();
  }

  const description = job.description_text.slice(0, 155).trim();

  return {
    title: `${job.title} — Netflix Jobs`,
    description: description || `${job.title} at Netflix.`,
    alternates: { canonical: job.canonical_url },
  };
}

export default async function JobPage({ params }: JobPageProps) {
  const { jobid: jobId } = await params;
  // Both cached under the same tag and the same profile, so they cannot be a
  // crawl apart, and the site table is 36 rows the listing has already paid for
  // -- this page is what turns a posting's location slugs into the words for
  // them and the links to them. Requested together rather than in sequence: the
  // second does not depend on the first.
  const [job, catalog] = await Promise.all([getJob(jobId), listSites()]);

  if (!job) {
    notFound();
  }

  // This is the leaf page for one posting, which is the only place Google
  // accepts JobPosting: "Put structured data on the most detailed leaf page
  // possible. Don't add structured data to pages intended to present a list of
  // jobs." The listing therefore carries none, by design rather than by omission.
  //
  // buildJobPosting returns null when a required property cannot be filled from
  // the crawl. Emitting nothing beats emitting an invalid posting, and
  // tools/structured-data fails the build if any active job lands here.
  const posting = buildJobPosting(job);

  return (
    <article className="job-article">
      <JobHeader catalog={catalog} job={job} />

      <div className="job-body">
        <JobDescription html={job.description_html} />
        <JobDetails catalog={catalog} job={job} />
      </div>

      {/* Last, not first. The JobPosting's `description` is the whole
          description again -- Google requires the full HTML -- so these two
          blocks are ~7.9KB, and there is no reason for the h1 and the hero to
          sit behind them in the byte stream. Position inside <body> means
          nothing to a JSON-LD consumer.

          It is worth saying what this did NOT fix: moving them here did not
          move Lighthouse. Measured on /jobs/JR41938, LCP was 0.97 both leading
          and trailing, against 0.98 for the page with no JSON-LD at all. The
          cost is the bytes, not their position -- see the note in
          tools/structured-data/README.md. */}
      {posting ? <JsonLd data={posting} /> : null}
      <JsonLd data={buildBreadcrumbs(job)} />
    </article>
  );
}
