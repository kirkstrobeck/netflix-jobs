import { ApplyButton } from "@/app/(site)/jobs/[jobid]/apply-button";
import { PostedDate } from "@/app/(site)/jobs/[jobid]/posted-date";
import { ShareButton } from "@/app/(site)/jobs/[jobid]/share-button";
import { BarsStage } from "@/app/_bars/bars-stage";
import { formatPostedDate } from "@/lib/format/posted-date";
import { postedOn } from "@/lib/jobs/date-posted";
import { jobPlaces, placeLine } from "@/lib/jobs/job-places";
import { jobShare } from "@/lib/jobs/job-share";
import type { Site } from "@/lib/jobs/site";
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
// THE HERO PRINTS THE PLACES; THE DETAILS CARD LINKS THEM
//
// Same words in both, out of jobPlaces, which is the change this needed. The
// hero used to print the crawl's own string -- 'USA - Remote' -- while the card
// below it named the site record, 'Remote, United States', so one page spelled
// one office two ways and only the second of them matched the facet it filters
// on. One vocabulary, and it is the listing's.
//
// Text here, links there. This band is a summary read on the way to a decision,
// and it sits directly above the page's one primary action; three underlined
// facts beside Apply is three invitations to leave. The card below is the
// structured record of the posting, every value under its own term, which is
// where a value being a filter is useful rather than distracting.
export function JobHeader({ job, catalog }: { job: Job; catalog: Site[] }) {
  const places = jobPlaces(job, catalog);
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
        <li className="job-facts__item">{placeLine(places)}</li>
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
