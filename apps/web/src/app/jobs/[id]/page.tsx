import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobDescription } from "@/app/jobs/[id]/job-description";
import { JobDetails } from "@/app/jobs/[id]/job-details";
import { JobHeader } from "@/app/jobs/[id]/job-header";
import { getJob } from "@/lib/jobs/get-job";
import { listRecentJobIds } from "@/lib/jobs/job-ids";

import "@/app/jobs/[id]/job-hero.css";
import "@/app/jobs/[id]/job-details.css";
import "@/app/jobs/[id]/prose.css";

type JobPageProps = { params: Promise<{ id: string }> };

// Required to return at least one param under `cacheComponents`. It also takes
// `params` out of the runtime-API set, which is what lets this page await it
// directly instead of hiding the whole job behind a <Suspense> fallback.
export async function generateStaticParams() {
  const ids = await listRecentJobIds();

  return ids.map((id) => ({ id }));
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);

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
  const { id } = await params;
  const job = await getJob(id);

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
