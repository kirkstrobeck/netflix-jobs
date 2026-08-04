// Full crawl of the Netflix Eightfold board into local Supabase.
//
//   pnpm --filter @netflix-jobs/ingestor ingest
//
// Two phases: page the list endpoint to enumerate every posting, then fetch the
// detail endpoint per posting for the description the list omits. Detail fetches
// fail soft — a job with no description still lands, flagged by an empty
// description_text — so one bad posting cannot abort a 481-job run.

import {
  LIST_PAGE_SIZE,
  SORT_ORDERS,
  fetchDetail,
  fetchListPage,
  type Position,
} from '../lib/eightfold.ts';
import { configureReader, transportCounts } from '../lib/http.ts';
import {
  countJobs,
  deactivateMissing,
  finishRun,
  ingestJobs,
  startRun,
  type JobRow,
} from '../lib/db.ts';
import { createSemaphore } from '../lib/semaphore.ts';
import { mapPosition } from '../lib/map-position.ts';

const DETAIL_CONCURRENCY = Number(process.env.DETAIL_CONCURRENCY ?? 3);
const READER_CONCURRENCY = Number(process.env.READER_CONCURRENCY ?? 3);
const READER_SPACING_MS = Number(process.env.READER_SPACING_MS ?? 2200);
const WRITE_BATCH = Number(process.env.WRITE_BATCH ?? 50);
const MAX_JOBS = Number(process.env.MAX_JOBS ?? 0);

const counts = { listed: 0, detailOk: 0, detailFailed: 0, upserted: 0, deactivated: 0 };
const failures: string[] = [];

async function sweep(
  seen: Map<string, Position>,
  total: number,
  sortBy: string,
): Promise<void> {
  for (let start = 0; start < total; start += LIST_PAGE_SIZE) {
    const page = await fetchListPage(start, sortBy);
    if (page.positions.length === 0) break;
    for (const position of page.positions) seen.set(String(position.id), position);
    const pageNumber = start / LIST_PAGE_SIZE + 1;
    console.log(
      `  ${sortBy} page ${pageNumber}: +${page.positions.length} (${seen.size}/${total} unique)`,
    );
    if (seen.size >= total) return;
  }
}

async function enumeratePositions(): Promise<Position[]> {
  const probe = await fetchListPage(0);
  const total = MAX_JOBS > 0 ? Math.min(MAX_JOBS, probe.total) : probe.total;
  console.log(`board reports ${probe.total} positions; crawling ${total}`);

  const seen = new Map<string, Position>();
  for (const sortBy of SORT_ORDERS) {
    await sweep(seen, total, sortBy);
    if (seen.size >= total) break;
    console.log(`  ${sortBy} sweep left ${total - seen.size} unseen; re-sweeping`);
  }

  if (seen.size < total) {
    console.log(`  WARNING: enumerated ${seen.size} of ${total} reported positions`);
  }

  const all = [...seen.values()];
  return MAX_JOBS > 0 ? all.slice(0, MAX_JOBS) : all;
}

async function detailFor(position: Position): Promise<Position | null> {
  try {
    const detail = await fetchDetail(String(position.id));
    counts.detailOk += 1;
    return detail;
  } catch (err) {
    counts.detailFailed += 1;
    const reason = err instanceof Error ? err.message : String(err);
    failures.push(`${position.id}: ${reason}`);
    console.log(`  detail ${position.id} FAILED: ${reason}`);
    return null;
  }
}

async function collectRows(positions: Position[], started: number): Promise<JobRow[]> {
  const gate = createSemaphore(DETAIL_CONCURRENCY);
  const progress = { done: 0 };

  return Promise.all(
    positions.map((position) =>
      gate.run(async () => {
        const detail = await detailFor(position);
        progress.done += 1;
        if (progress.done % 25 === 0) {
          const elapsed = Math.round((Date.now() - started) / 1000);
          console.log(`  detail ${progress.done}/${positions.length} (${elapsed}s)`);
        }
        return mapPosition(position, detail);
      }),
    ),
  );
}

async function writeRows(rows: JobRow[], runId: string): Promise<void> {
  for (let index = 0; index < rows.length; index += WRITE_BATCH) {
    const batch = rows.slice(index, index + WRITE_BATCH);
    await ingestJobs(batch, runId);
    counts.upserted += batch.length;
    console.log(`  wrote ${counts.upserted}/${rows.length}`);
  }
}

async function main(): Promise<void> {
  configureReader(READER_CONCURRENCY, READER_SPACING_MS);
  const runId = await startRun();
  console.log(`ingest run ${runId}`);

  const started = Date.now();
  let status = 'succeeded';

  try {
    const positions = await enumeratePositions();
    counts.listed = positions.length;
    console.log(`enumerated ${counts.listed} positions; fetching details`);

    const rows = await collectRows(positions, started);
    await writeRows(rows, runId);
    counts.deactivated = await deactivateMissing(runId);
  } catch (err) {
    status = 'failed';
    failures.push(err instanceof Error ? err.message : String(err));
    console.error('ingest failed:', err);
  }

  const transports = transportCounts();
  const notes = [
    `transport direct=${transports.direct} reader=${transports.reader}`,
    failures.length > 0 ? `failures: ${failures.slice(0, 20).join('; ')}` : 'no failures',
  ].join(' | ');

  await finishRun(runId, status, counts, notes);

  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log(`\n${status} in ${elapsed}s`);
  console.log(JSON.stringify({ ...counts, transports, rowsInDb: await countJobs() }, null, 2));
  process.exit(status === 'succeeded' ? 0 : 1);
}

main();
