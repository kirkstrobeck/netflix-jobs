"use client";

import { memo } from "react";

import { PostedDate } from "@/app/(site)/jobs/[jobid]/posted-date";
import { formatPostedDate } from "@/lib/format/posted-date";
import type { JobSummary } from "@/lib/jobs/job-summary";

// A result is one line: the title, and how long it has been open. Team,
// location and work type were three more columns of text per row, repeated
// twenty times down the page, and every one of them is already a filter in the
// panel beside this list -- so the row was answering a question the visitor had
// just answered themselves. What is left is the thing being chosen between.
//
// The posted date stays because it is the one fact the filters do not carry and
// the only one that ages: it is what says which of two similar-looking roles is
// worth opening first.
//
// memo, and the only prop is the row itself. Filtering rebuilds the page ARRAY
// on every keystroke, but the rows in it are the same objects out of the same
// board, so a row that survived the change is === the row that was already
// there and React skips it. Paging from 1 to 2 re-renders twenty rows because
// twenty rows changed; narrowing a facet from 40 results to 30 re-renders none
// of the ones that stayed. Each row formats a date and mounts a PostedDate that
// runs its own effect, so skipping is worth the comparison.
function Row({ job }: { job: JobSummary }) {
  const posted = formatPostedDate(job.posting_date);

  return (
    <li className="result">
      {/* h3: the page runs h1 (masthead) -> h2 ("Open roles") -> h3 per result,
          so a screen reader's heading list nests instead of flattening. */}
      <h3 className="result__title">
        {/* One real link with one real href, and the whole row is its hit area
            -- stretched over the row by .result__link::after rather than by a
            click handler, so there is nothing here to go wrong with JavaScript
            off and nothing extra for a keyboard to stop at. */}
        <a className="result__link" href={`/jobs/${job.display_job_id}`}>
          {job.title}
        </a>
      </h3>

      {/* Still a <dl>: one date is still a named value, and the name is what
          makes "3 days ago" mean posted rather than closing. The name is
          visually hidden because it no longer earns its place on screen -- it
          was a column caption, and there is only one column left to caption. */}
      <dl className="result__posted">
        <dt className="visually-hidden">Posted</dt>
        {posted ? (
          <dd className="result__date">
            {/* Same treatment as the detail page: the server sends the absolute
                date and the client swaps in relative time. There is no badge
                riding with it -- see posted-date.tsx. */}
            <PostedDate absolute={posted} iso={job.posting_date!} />
          </dd>
        ) : (
          <dd className="result__date result__date--empty">Not listed</dd>
        )}
      </dl>
    </li>
  );
}

export const ResultRow = memo(Row);
