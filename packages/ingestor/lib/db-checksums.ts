import { authHeaders, supabaseUrl } from './db.ts';

// public.job_checksums, read and written. Its own module rather than four more
// functions on db.ts, for the reason the migration gives: these are facts about
// the web app's CACHE, not about a posting, and they are written on their own
// round trip after the postings have landed.

/** One stored row: what the previous crawl left behind for this posting. */
export type ChecksumRow = {
  position_id: number;
  display_job_id: string | null;
  board_checksum: string;
  content_checksum: string;
};

/** A stored row plus whether the posting it belongs to was on the board. */
export type PriorChecksum = ChecksumRow & { wasActive: boolean };

type StoredRow = ChecksumRow & { jobs: { is_active: boolean } | null };

const SELECT = 'position_id,display_job_id,board_checksum,content_checksum,jobs(is_active)';

async function send(path: string, init: RequestInit, extra: Record<string, string> = {}) {
  const res = await fetch(`${supabaseUrl()}${path}`, { ...init, headers: authHeaders(extra) });
  const body = await res.text();

  if (!res.ok) throw new Error(`${init.method} ${path} -> ${res.status}: ${body}`);

  return body ? (JSON.parse(body) as unknown) : null;
}

/**
 * Every stored checksum, keyed by position_id.
 *
 * `is_active` comes along embedded through the foreign key, because "was this
 * role on the board last time" is a different question from "do we have a
 * checksum for it". A role that was deactivated and has come back is a change to
 * the board's SET even when its content digest is identical to the one stored
 * before it went away -- without this column that case would be silently missed.
 *
 * An empty map is the first-run answer and is not an error: every role then
 * reads as new, which is exactly right, since nothing rendered from these rows
 * has ever been cached.
 */
export async function readChecksums(): Promise<Map<number, PriorChecksum>> {
  const rows = (await send(
    `/rest/v1/job_checksums?select=${SELECT}&order=position_id`,
    { method: 'GET' },
    { Range: '0-99999' },
  )) as StoredRow[] | null;

  return new Map(
    (rows ?? []).map((row) => [
      row.position_id,
      {
        position_id: row.position_id,
        display_job_id: row.display_job_id,
        board_checksum: row.board_checksum,
        content_checksum: row.content_checksum,
        wasActive: row.jobs?.is_active ?? false,
      },
    ]),
  );
}

/**
 * Record what this crawl rendered.
 *
 * Called only after the web app has confirmed the flush -- see cache-flush.ts.
 * Writing these before the POST lands would tell the next run "already handled"
 * about an invalidation that never arrived, and the stale page would then sit
 * there until the 30-day expire, with nothing anywhere saying why.
 */
export async function writeChecksums(rows: ChecksumRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const stamped = rows.map((row) => ({ ...row, updated_at: new Date().toISOString() }));

  await send(
    '/rest/v1/job_checksums',
    { method: 'POST', body: JSON.stringify(stamped) },
    { Prefer: 'resolution=merge-duplicates,return=minimal' },
  );

  return rows.length;
}
