"use client";

import { memo } from "react";

import { PostedDate } from "@/app/(site)/jobs/[jobid]/posted-date";
import { formatLocations } from "@/lib/format/location";
import { formatPostedDate } from "@/lib/format/posted-date";
import { jobLocations, type JobSummary } from "@/lib/jobs/job-summary";

// A result reads as one line of information, not a table row: the title is the
// link and the facts sit under it in fixed columns, so team lines up with team
// down the page without any of the furniture -- rules, headers, stripes -- that
// would make it a table.
//
// memo, and the only prop is the row itself. Filtering rebuilds the page ARRAY
// on every keystroke, but the rows in it are the same objects out of the same
// board, so a row that survived the change is === the row that was already
// there and React skips it. Paging from 1 to 2 re-renders ten rows because ten
// rows changed; narrowing a facet from 40 results to 30 re-renders none of the
// ones that stayed. Each row formats two dates and mounts a PostedDate that
// runs its own effect, so skipping is worth the comparison.
function Row({ job }: { job: JobSummary }) {
  const locations = formatLocations(jobLocations(job), job.location);
  const posted = formatPostedDate(job.posting_date);

  return (
    <li className="result">
      {/* h3: the page runs h1 (masthead) -> h2 ("Open roles") -> h3 per result,
          so a screen reader's heading list nests instead of flattening. */}
      <h3 className="result__title">
        {/* The whole title is the target, so the hit area matches the text. */}
        <a className="result__link" href={`/jobs/${job.display_job_id}`}>
          {job.title}
        </a>
      </h3>

      <dl className="result__facts">
        <div className="result__fact result__fact--team">
          <dt className="result__label">Team</dt>
          <dd className="result__value">{job.team ?? "Not listed"}</dd>
        </div>

        <div className="result__fact result__fact--location">
          <dt className="result__label">Location</dt>
          <dd className="result__value">
            {locations.length > 0 ? locations.join(" · ") : "To be confirmed"}
          </dd>
        </div>

        <div className="result__fact result__fact--type">
          <dt className="result__label">Work type</dt>
          <dd className="result__value">{job.work_type ?? "Not listed"}</dd>
        </div>

        <div className="result__fact result__fact--posted">
          <dt className="result__label">Posted</dt>
          <dd className="result__value">
            {posted ? (
              // Same treatment as the detail page: the server sends the absolute
              // date, the client swaps in relative time, and the New badge comes
              // with it for anything inside its first week.
              <PostedDate absolute={posted} iso={job.posting_date!} />
            ) : (
              <span className="result__empty">Not listed</span>
            )}
          </dd>
        </div>
      </dl>
    </li>
  );
}

export const ResultRow = memo(Row);
