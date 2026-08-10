import { describe, expect, it } from 'vitest';

import { diffCaches } from './cache-diff.ts';
import { boardChecksum, contentChecksum } from './checksum.ts';
import type { PriorChecksum } from './db-checksums.ts';
import type { JobRow } from './db.ts';

function row(overrides: Partial<JobRow> = {}): JobRow {
  return {
    position_id: '1',
    display_job_id: 'JR00001',
    ats_job_id: null,
    job_req_id: null,
    title: 'Software Engineer',
    posting_name: null,
    normalized_title: 'software engineer',
    department: 'Engineering',
    business_unit: 'Streaming',
    team: 'Engineering',
    location: 'Los Gatos,California,United States of America',
    locations: ['Los Gatos,California,United States of America'],
    location_slugs: ['us-los-gatos'],
    work_location_option: null,
    location_flexibility: null,
    work_type: 'Onsite',
    description_html: '<p>Work here</p>',
    description_text: 'Work here',
    canonical_url: 'https://example.test/job',
    locale: 'en',
    is_hot: false,
    is_private: false,
    posting_date: '2026-08-01',
    source_created_at: null,
    source_updated_at: null,
    raw: {},
    ...overrides,
  };
}

// What the previous crawl would have stored for exactly this row.
function stored(job: JobRow, wasActive = true): [number, PriorChecksum] {
  return [
    Number(job.position_id),
    {
      position_id: Number(job.position_id),
      display_job_id: job.display_job_id,
      board_checksum: boardChecksum(job),
      content_checksum: contentChecksum(job),
      wasActive,
    },
  ];
}

describe('diffCaches', () => {
  // The normal case, and the entire point: `pnpm ingest` on a board that has not
  // moved says nothing at all. The previous version fired the board tag on every
  // run and threw away every cached render for it.
  it('names nothing when every role is byte-identical', () => {
    const jobs = [row(), row({ position_id: '2', display_job_id: 'JR00002' })];
    const prior = new Map(jobs.map((job) => stored(job)));

    expect(diffCaches(jobs, prior, 0)).toMatchObject({
      jobIds: [],
      board: false,
      added: 0,
    });
  });

  // FIRST RUN, OR ANY RUN AFTER THE TABLE IS EMPTIED. There is no evidence about
  // what is in the cache, so the only honest claim is that all of it is suspect.
  it('names every role and the board when nothing has ever been stored', () => {
    const jobs = [row(), row({ position_id: '2', display_job_id: 'JR00002' })];

    expect(diffCaches(jobs, new Map(), 0)).toMatchObject({
      jobIds: ['JR00001', 'JR00002'],
      board: true,
      added: 2,
    });
  });

  // A rewritten description is the case the two digests exist for: one page is
  // wrong, and the 300-odd cached listing URLs are not.
  it('flushes one role and leaves the board standing when only its page moved', () => {
    const before = row();
    const after = row({ description_html: '<p>Rewritten</p>' });

    expect(diffCaches([after], new Map([stored(before)]), 0)).toMatchObject({
      jobIds: ['JR00001'],
      board: false,
    });
  });

  // A retitled role changes the row the board draws AND the page it links to.
  it('flushes the role and the board when a board-visible field moved', () => {
    const before = row();
    const after = row({ title: 'Staff Software Engineer' });

    expect(diffCaches([after], new Map([stored(before)]), 0)).toMatchObject({
      jobIds: ['JR00001'],
      board: true,
    });
  });

  // Nothing in the crawled rows can see a removal -- the role is simply absent
  // -- so deactivate_missing_jobs' count is the only signal there is.
  it('flushes the board on a removal, with no role page to name', () => {
    const jobs = [row()];

    expect(diffCaches(jobs, new Map([stored(jobs[0])]), 1)).toMatchObject({
      jobIds: [],
      board: true,
    });
  });

  // A role that was deactivated and has come back is a change to the SET the
  // board draws, even though its digests are identical to the stored ones. This
  // is why the prior row carries is_active and not just the checksums.
  it('treats a reactivated role as an addition', () => {
    const jobs = [row()];
    const prior = new Map([stored(jobs[0], false)]);

    expect(diffCaches(jobs, prior, 0)).toMatchObject({
      jobIds: ['JR00001'],
      board: true,
      added: 1,
    });
  });

  // Every link the board writes ends in display_job_id, so a role without one
  // has no /jobs/<id> entry to invalidate. It still counts toward the board.
  it('skips a role with no job code, but still moves the board', () => {
    const jobs = [row({ display_job_id: null })];

    expect(diffCaches(jobs, new Map(), 0)).toMatchObject({ jobIds: [], board: true });
  });

  it('returns a storable row per role, digests and all', () => {
    const jobs = [row()];
    const { rows } = diffCaches(jobs, new Map(), 0);

    expect(rows).toEqual([
      {
        position_id: 1,
        display_job_id: 'JR00001',
        board_checksum: boardChecksum(jobs[0]),
        content_checksum: contentChecksum(jobs[0]),
      },
    ]);
  });
});
