import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushCaches } from './cache-flush.ts';
import { boardChecksum, contentChecksum } from './checksum.ts';
import { writeChecksums } from './db-checksums.ts';
import type { JobRow } from './db.ts';
import { revalidateWeb } from './revalidate.ts';

vi.mock('./db-checksums.ts', () => ({ writeChecksums: vi.fn() }));

vi.mock('./revalidate.ts', () => ({ revalidateWeb: vi.fn() }));

const write = vi.mocked(writeChecksums);
const post = vi.mocked(revalidateWeb);

const logged: string[] = [];

function row(overrides: Partial<JobRow> = {}): JobRow {
  return {
    position_id: '1',
    display_job_id: 'JR00001',
    ats_job_id: null,
    job_req_id: null,
    title: 'Software Engineer',
    posting_name: null,
    normalized_title: 'software engineer',
    department: null,
    business_unit: null,
    team: null,
    location: '',
    locations: [],
    location_slugs: [],
    work_location_option: null,
    location_flexibility: null,
    work_type: null,
    description_html: '',
    description_text: '',
    apply_url: '',
    canonical_url: '',
    locale: null,
    is_hot: false,
    is_private: false,
    posting_date: null,
    source_created_at: null,
    source_updated_at: null,
    raw: {},
    ...overrides,
  };
}

function unchanged(job: JobRow) {
  return new Map([
    [
      Number(job.position_id),
      {
        position_id: Number(job.position_id),
        display_job_id: job.display_job_id,
        board_checksum: boardChecksum(job),
        content_checksum: contentChecksum(job),
        wasActive: true,
      },
    ],
  ]);
}

beforeEach(() => {
  logged.length = 0;
  vi.spyOn(console, 'log').mockImplementation((line: string) => void logged.push(line));
  write.mockReset();
  post.mockReset();
  write.mockResolvedValue(1);
  post.mockResolvedValue('ok');
});

describe('flushCaches', () => {
  it('sends nothing and stores nothing when nothing rendered changed', async () => {
    const job = row();

    const { report, note } = await flushCaches([job], 0, unchanged(job));

    expect(post).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(report.outcome).toBe('unchanged');
    expect(note).toBe('cache: unchanged | roles=0 board=false added=0');
    expect(logged.at(-1)).toContain('nothing rendered changed');
  });

  it('names the changed role and the board, then stores the digests', async () => {
    const { report } = await flushCaches([row({ title: 'Staff Engineer' })], 0, unchanged(row()));

    expect(post).toHaveBeenCalledExactlyOnceWith(['JR00001'], true);
    expect(write).toHaveBeenCalledOnce();
    expect(report.outcome).toBe('ok');
  });

  // THE ORDER IS THE WHOLE DESIGN. Storing the digests before the POST lands
  // would tell the NEXT run "already handled" about an invalidation that never
  // arrived, and the stale page would sit there for the full expire with nothing
  // anywhere saying why. Left unwritten, the next run re-detects and retries.
  it.each(['failed', 'skipped'] as const)(
    'stores nothing when the flush came back %s',
    async (outcome) => {
      post.mockResolvedValue(outcome);

      const { report } = await flushCaches(
        [row({ title: 'Staff Engineer' })],
        0,
        unchanged(row()),
      );

      expect(post).toHaveBeenCalledOnce();
      expect(write).not.toHaveBeenCalled();
      expect(report.outcome).toBe(outcome);
    },
  );

  it('flushes the board alone when a role was removed', async () => {
    const job = row();

    await flushCaches([job], 2, unchanged(job));

    expect(post).toHaveBeenCalledExactlyOnceWith([], true);
  });

  it('reports what it did for the run notes', async () => {
    const { note } = await flushCaches([row()], 0, new Map());

    expect(note).toBe('cache: ok | roles=1 board=true added=1');
  });
});
