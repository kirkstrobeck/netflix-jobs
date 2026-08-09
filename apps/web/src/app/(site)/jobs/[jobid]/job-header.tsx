import { ApplyButton } from "@/app/(site)/jobs/[jobid]/apply-button";
import { PostedDate } from "@/app/(site)/jobs/[jobid]/posted-date";
import { ShareButton } from "@/app/(site)/jobs/[jobid]/share-button";
import { BarsStage } from "@/app/_bars/bars-stage";
import { formatLocations } from "@/lib/format/location";
import { formatPostedDate } from "@/lib/format/posted-date";
import { postedOn } from "@/lib/jobs/date-posted";
import { jobShare } from "@/lib/jobs/job-share";
import type { Job } from "@/lib/jobs/types";

// posting_date is null on 179 of 481 rows, so the fact list renders a fixed set
// of slots and fills the empty one with an em dash. The row keeps its height
// either way, which is why nothing here can shift once the page paints.
//
// The date comes from postedOn(), the same call the JobPosting's datePosted
// comes from, and it carries its own verb: "Posted" for the date the employer
// stated, "Listed" for the fallback to when the posting appeared on Netflix's
// board. That is what keeps the markup describing something the visitor can
// actually read on the page.
export function JobHeader({ job }: { job: Job }) {
  const locations = formatLocations(job.locations, job.location);
  const on = postedOn(job);
  const posted = formatPostedDate(on?.iso ?? null);

  // The stage IS the <header>, not a wrapper inside it: the bars are the
  // masthead's backdrop, and the hero's padding-block is most of its height, so
  // a stage nested inside would leave that padding bare.
  return (
    <BarsStage as="header" className="job-hero">
      <p className="eyebrow">{job.department ?? "Netflix"}</p>

      <h1 className="job-title">{job.title}</h1>

      <ul className="job-facts">
        <li className="job-facts__item">
          {locations.length > 0 ? locations.join(" · ") : "Location to be confirmed"}
        </li>
        <li className="job-facts__item">{job.work_type ?? "On site"}</li>
        <li className="job-facts__item">
          {posted && on ? (
            <>
              {on.verb} <PostedDate absolute={posted} iso={on.iso} />
            </>
          ) : (
            <span className="job-facts__empty">Posted date not listed</span>
          )}
        </li>
      </ul>

      {/* Apply is the page's one primary action; Share sits beside it as the
          only other thing you can do with a posting. They are grouped so the
          gap between them reads as smaller than the gap above them. */}
      <div className="job-cta">
        <ApplyButton href={job.apply_url} title={job.title} />
        <ShareButton share={jobShare(job)} />
      </div>
    </BarsStage>
  );
}
