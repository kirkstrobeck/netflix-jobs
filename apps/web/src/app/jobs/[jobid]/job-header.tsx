import { ApplyButton } from "@/app/jobs/[jobid]/apply-button";
import { formatLocations } from "@/lib/format/location";
import { formatPostedDate } from "@/lib/format/posted-date";
import type { Job } from "@/lib/jobs/types";

// posting_date is null on 179 of 481 rows, so the fact list renders a fixed set
// of slots and fills the empty one with an em dash. The row keeps its height
// either way, which is why nothing here can shift once the page paints.
export function JobHeader({ job }: { job: Job }) {
  const locations = formatLocations(job.locations, job.location);
  const posted = formatPostedDate(job.posting_date);

  return (
    <header className="job-hero">
      <p className="eyebrow">{job.department ?? "Netflix"}</p>

      <h1 className="job-title">{job.title}</h1>

      <ul className="job-facts">
        <li className="job-facts__item">
          {locations.length > 0 ? locations.join(" · ") : "Location to be confirmed"}
        </li>
        <li className="job-facts__item">{job.work_type ?? "On site"}</li>
        <li className="job-facts__item">
          {posted ? (
            <>
              Posted <time dateTime={job.posting_date ?? undefined}>{posted}</time>
            </>
          ) : (
            <span className="job-facts__empty">Posted date not listed</span>
          )}
        </li>
      </ul>

      <ApplyButton href={job.apply_url} title={job.title} />
    </header>
  );
}
