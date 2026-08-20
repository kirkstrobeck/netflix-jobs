import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/reingest-creds.ts', () => ({
  hostedCreds: vi.fn().mockResolvedValue({
    url: 'http://hosted',
    serviceRoleKey: 'svc',
    revalidateUrl: 'https://prod/api/revalidate',
    revalidateSecret: 'secret',
  }),
}));
vi.mock('../lib/db-checksums.ts', () => ({
  readChecksums: vi.fn().mockResolvedValue(new Map()),
  writeChecksums: vi.fn(),
}));
vi.mock('../lib/db.ts', () => ({
  readActiveJobs: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/cache-flush.ts', () => ({
  flushCaches: vi.fn().mockResolvedValue({
    report: { jobIds: [], board: false, added: 0, outcome: 'unchanged' },
    note: 'cache: unchanged',
  }),
}));

import { hostedCreds } from '../lib/reingest-creds.ts';
import { readChecksums } from '../lib/db-checksums.ts';
import { readActiveJobs } from '../lib/db.ts';
import { flushCaches } from '../lib/cache-flush.ts';
import { main } from './cache-bust.ts';

beforeEach(() => {
  vi.mocked(hostedCreds).mockResolvedValue({
    url: 'http://hosted',
    serviceRoleKey: 'svc',
    revalidateUrl: 'https://prod/api/revalidate',
    revalidateSecret: 'secret',
  });
  vi.mocked(readChecksums).mockResolvedValue(new Map());
  vi.mocked(readActiveJobs).mockResolvedValue([]);
  vi.mocked(flushCaches).mockResolvedValue({
    report: { jobIds: [], board: false, added: 0, outcome: 'unchanged' },
    note: 'cache: unchanged',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cache-bust', () => {
  it('calls flushCaches with active rows and computed deactivated count', async () => {
    const prior = new Map([
      [1, { position_id: 1, display_job_id: 'job-1', board_checksum: 'a', content_checksum: 'b', wasActive: true }],
      [2, { position_id: 2, display_job_id: 'job-2', board_checksum: 'c', content_checksum: 'd', wasActive: true }],
    ]);
    vi.mocked(readChecksums).mockResolvedValue(prior);
    // Only job 1 is still active; job 2 was deactivated
    vi.mocked(readActiveJobs).mockResolvedValue([
      { position_id: '1', display_job_id: 'job-1', title: 'Engineer', team: null,
        business_unit: null, work_type: null, posting_date: null, location_slugs: [],
        department: null, location: 'US', locations: [], description_html: '',
        description_text: '', canonical_url: '', source_created_at: null } as any,
    ]);

    await main();

    // deactivated = 1 (job 2 was wasActive but not in current active set)
    expect(vi.mocked(flushCaches)).toHaveBeenCalledWith(
      expect.any(Array),
      1, // deactivated count
      prior,
    );
  });

  it('does not call revalidateWeb directly — routes through flushCaches', async () => {
    await main();
    // flushCaches must be called; it is the only path to revalidateWeb
    expect(vi.mocked(flushCaches)).toHaveBeenCalled();
  });

  it('throws when revalidateUrl is missing from hosted env', async () => {
    vi.mocked(hostedCreds).mockResolvedValue({
      url: 'http://hosted',
      serviceRoleKey: 'svc',
      revalidateUrl: undefined,
      revalidateSecret: 'secret',
    });
    await expect(main()).rejects.toThrow('REVALIDATE_URL missing');
  });
});
