import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { JobDescription } from "@/app/(site)/jobs/[jobid]/job-description";
import { JobDetails } from "@/app/(site)/jobs/[jobid]/job-details";
import { JobHeader } from "@/app/(site)/jobs/[jobid]/job-header";
import { jobTag } from "@/lib/jobs/cache-tags";
import { getJob } from "@/lib/jobs/get-job";
import { listRecentJobIds } from "@/lib/jobs/job-ids";
import { listSites } from "@/lib/jobs/list-sites";
import { buildBreadcrumbs } from "@/lib/seo/breadcrumbs";
import { buildJobPosting } from "@/lib/seo/job-posting";
import { JsonLd } from "@/lib/seo/json-ld";

import "@/app/_ultra/ultra.css";
import "@/app/(site)/jobs/[jobid]/job-hero.css";
import "@/app/(site)/jobs/[jobid]/job-cta.css";
import "@/app/(site)/jobs/[jobid]/share-note.css";
import "@/app/(site)/jobs/[jobid]/job-facts.css";
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

/**
 * ONE CACHE ENTRY PER POSTING, HOLDING FINISHED MARKUP.
 *
 * `jobId` is the whole cache key, so 481 postings are 481 entries and each is
 * replaced on its own. cacheTag names only that posting: the board tag is
 * deliberately NOT here, and is no longer on getJob either. A crawl that adds
 * one role used to flush all 481 of these; now the ingestor names the roles
 * whose content actually moved and nothing else is touched.
 *
 * `notFound()` stays OUTSIDE this scope. Throwing a navigation signal out of a
 * cached function would put "this is a 404" in the cache entry, so the miss is
 * spelled as a returned null and answered by the caller.
 */
async function jobArticle(jobId: string) {
  "use cache";
  cacheLife("jobs");
  cacheTag(jobTag(jobId));

  // The site table is 36 rows -- this page is what turns a posting's location
  // slugs into the words for them and the links to them. Requested alongside
  // the posting rather than after it: the second does not depend on the first.
  const [job, catalog] = await Promise.all([getJob(jobId), listSites()]);

  if (!job) {
    return null;
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
    // The posting carries the 76rem column itself now. It used to inherit one
    // from <main>, which had to give it up so the home masthead's divider could
    // reach the edges of the page; this is the same measure in the same class,
    // one element further down.
    <article className="shell job-article">
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

// `params` is not a request-time API here -- generateStaticParams above supplies
// samples -- so it can be awaited outright and the render below is a cache read,
// not a Supabase round trip.
export default async function JobPage({ params }: JobPageProps) {
  const { jobid: jobId } = await params;
  const article = await jobArticle(jobId);

  if (!article) {
    notFound();
  }

  return article;
}
