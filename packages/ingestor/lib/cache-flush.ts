import { diffCaches } from './cache-diff.ts';
import { writeChecksums, type PriorChecksum } from './db-checksums.ts';
import type { JobRow } from './db.ts';
import { revalidateWeb } from './revalidate.ts';

// The last act of a crawl: work out what actually moved, tell the web app, and
// only then write down that it was told.
//
// THE ORDER IS THE WHOLE DESIGN.
//
// Checksums are stored AFTER the POST comes back ok. Storing them first would be
// the natural way round and it is the broken one: a flush that never arrived --
// web app down, secret rotated, deploy mid-flight -- would leave the next crawl
// comparing against digests that describe pages the cache does not hold, so it
// would find nothing changed and never retry. The stale page would then sit
// there for the full 30-day expire with no signal anywhere. Written last, a
// failed call simply leaves the previous crawl's digests in place and the next
// run re-detects the same difference and tries again.
//
// A run where nothing moved sends nothing at all. That is the normal case, and
// it is the entire point of the checksums: `pnpm ingest` on an unchanged board
// used to fire JOBS_BOARD_TAG and throw away every cached render for it.

export type FlushReport = {
  jobIds: string[];
  board: boolean;
  added: number;
  /** 'unchanged' when there was nothing to say; otherwise revalidateWeb's own. */
  outcome: 'unchanged' | 'ok' | 'skipped' | 'failed';
};

function note(report: FlushReport): string {
  return `cache: ${report.outcome} | roles=${report.jobIds.length} board=${report.board} added=${report.added}`;
}

// `prior` is passed in rather than read here, and that is not a testability
// flourish: it has to be read BEFORE the crawl's writes land. ingest_jobs sets
// is_active = true on conflict, so after the write every crawled role looks like
// it was on the board all along, and a role that had been deactivated and has
// just come back would read as unchanged. See the read in bin/ingest.ts.
export async function flushCaches(
  jobs: JobRow[],
  deactivated: number,
  prior: Map<number, PriorChecksum>,
): Promise<{ report: FlushReport; note: string }> {
  const diff = diffCaches(jobs, prior, deactivated);

  if (diff.jobIds.length === 0 && !diff.board) {
    console.log('  cache: nothing rendered changed -- no revalidation sent');

    const report: FlushReport = { jobIds: [], board: false, added: 0, outcome: 'unchanged' };

    return { report, note: note(report) };
  }

  console.log(
    `  cache: ${diff.jobIds.length} role page(s) changed, board ${diff.board ? 'moved' : 'unchanged'}`,
  );

  const outcome = await revalidateWeb(diff.jobIds, diff.board);
  const report: FlushReport = { ...diff, outcome };

  if (outcome === 'ok') {
    console.log(`  cache: stored ${await writeChecksums(diff.rows)} checksums`);
  }

  return { report, note: note(report) };
}
