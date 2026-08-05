import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobDescription } from "@/app/jobs/[jobid]/job-description";
import { JobDetails } from "@/app/jobs/[jobid]/job-details";
import { JobHeader } from "@/app/jobs/[jobid]/job-header";
import { getJob } from "@/lib/jobs/get-job";
import { listRecentJobIds } from "@/lib/jobs/job-ids";

import "@/app/jobs/[jobid]/job-hero.css";
import "@/app/jobs/[jobid]/job-details.css";
import "@/app/jobs/[jobid]/prose.css";

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

  if (!job) {
    return { title: "Job not found — Netflix Jobs" };
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
  const job = await getJob(jobId);

  if (!job) {
    notFound();
  }

  return (
    <article className="job-article">
      <JobHeader job={job} />

      <div className="job-body">
        <JobDescription html={job.description_html} />
        <JobDetails job={job} />
      </div>
    </article>
  );
}
