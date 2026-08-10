import { boardChecksum, contentChecksum } from './checksum.ts';
import type { ChecksumRow, PriorChecksum } from './db-checksums.ts';
import type { JobRow } from './db.ts';

/** What this crawl changed, in the terms the web app's cache tags are in. */
export type CacheDiff = {
  /** Every role's digests as of now, ready to store once the flush lands. */
  rows: ChecksumRow[];
  /** The roles whose own page has to be thrown away. Becomes `job:<ID>`. */
  jobIds: string[];
  /** Whether the listing has to be thrown away. Becomes `jobs-board`. */
  board: boolean;
  /** For the run notes: how many roles the board had never seen. */
  added: number;
};

function toRow(job: JobRow): ChecksumRow {
  return {
    position_id: Number(job.position_id),
    display_job_id: job.display_job_id,
    board_checksum: boardChecksum(job),
    content_checksum: contentChecksum(job),
  };
}

// A role the board did not have a moment ago: either no checksum was ever stored
// for it, or one was and the posting behind it was inactive -- deactivated by an
// earlier crawl and now back. Both are additions to the SET the listing shows.
function isNew(prior: PriorChecksum | undefined): boolean {
  return !prior?.wasActive;
}

/**
 * Two lists and a boolean: what to invalidate, and what to remember afterwards.
 *
 * THE RULE IS THAT A TAG IS A CLAIM, AND EVERY CLAIM HERE IS CHECKED.
 *
 * `jobs-board` is fired when, and only when, the set the listing draws has
 * actually moved: a role added, a role removed, or a role whose board-visible
 * fields changed. A crawl that re-fetched 481 identical postings fires nothing,
 * which is the normal case and the whole point -- the previous version fired the
 * board tag on every run and threw away every cached render for it.
 *
 * `job:<ID>` is fired per role, off the wider digest, so a rewritten description
 * flushes one posting's page and leaves the listing -- and the other 480
 * postings -- exactly where they were.
 *
 * FIRST RUN, OR ANY RUN AFTER THE TABLE IS EMPTIED: `prior` is empty, so every
 * role is new, so every id is named and the board is flushed. That is the
 * correct answer rather than a degenerate one -- there is no evidence about what
 * is in the cache, so the only honest claim is that all of it is suspect. It
 * costs one re-render per page that is actually visited afterwards.
 *
 * `deactivated` comes from deactivate_missing_jobs and is the removal signal.
 * Nothing else can see a removal: a role that vanished from the board is absent
 * from `jobs`, so no amount of digesting the rows that ARE here would notice it.
 */
export function diffCaches(
  jobs: JobRow[],
  prior: Map<number, PriorChecksum>,
  deactivated: number,
): CacheDiff {
  const rows = jobs.map(toRow);
  const fresh = rows.filter((row) => isNew(prior.get(row.position_id)));

  const moved = rows.filter((row) => {
    const before = prior.get(row.position_id);

    return isNew(before) || before.content_checksum !== row.content_checksum;
  });

  const boardMoved = rows.some((row) => {
    const before = prior.get(row.position_id);

    return isNew(before) || before.board_checksum !== row.board_checksum;
  });

  return {
    rows,
    // A role with no code has no page to flush: every link the board writes
    // ends in display_job_id, so there is no /jobs/<null> entry to invalidate.
    jobIds: moved
      .map((row) => row.display_job_id)
      .filter((id): id is string => typeof id === 'string' && id !== ''),
    board: boardMoved || deactivated > 0,
    added: fresh.length,
  };
}
