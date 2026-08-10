import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadIngest, logged, resetIngestEnv } from './ingest.harness.ts';

vi.mock('../lib/eightfold.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/eightfold.ts')>();
  return { ...actual, fetchListPage: vi.fn(), fetchDetail: vi.fn() };
});

vi.mock('../lib/http.ts', () => ({
  fetchJson: vi.fn(),
  configureReader: vi.fn(),
  currentTransport: vi.fn(() => 'direct'),
  transportCounts: vi.fn(() => ({ direct: 0, reader: 0 })),
  resetTransportState: vi.fn(),
}));

vi.mock('../lib/db.ts', () => ({
  startRun: vi.fn(async () => 'run-1'),
  finishRun: vi.fn(async () => undefined),
  ingestJobs: vi.fn(async () => 0),
  upsertLocations: vi.fn(async () => 0),
  deactivateMissing: vi.fn(async () => 0),
  countJobs: vi.fn(async () => 0),
}));

vi.mock('../lib/revalidate.ts', () => ({
  revalidateWeb: vi.fn(async () => 'ok'),
}));

// Mocked as a unit rather than through its parts: the crawl's contract with it
// is one call at the end, and what it decides from the checksums is
// cache-diff.test.ts's business, not this file's.
vi.mock('../lib/cache-flush.ts', () => ({ flushCaches: vi.fn() }));

// The prior digests, read before the writes. Mocked because the harness resets
// it like every other seam; what it is FOR is bin/ingest-cache.test.ts.
vi.mock('../lib/db-checksums.ts', () => ({
  readChecksums: vi.fn(),
  writeChecksums: vi.fn(),
}));

beforeEach(() => {
  logged.length = 0;
  vi.spyOn(console, 'log').mockImplementation((message: string) => {
    logged.push(message);
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetIngestEnv();
  vi.restoreAllMocks();
});

describe('site seeding', () => {
  // The requirement behind the seed: a site nobody has given coordinates to
  // costs the posting one link and takes nothing else down with it.
  it('seeds the sites first, then names every one the seed does not cover', async () => {
    const ctx = await loadIngest();
    ctx.db.upsertLocations.mockResolvedValue(36);
    ctx.eightfold.fetchListPage.mockResolvedValue({
      positions: [
        { id: 1, name: 'Role 1', locations: ['Tokyo,Japan', 'Nairobi,Kenya'] },
        { id: 2, name: 'Role 2', locations: ['Nairobi,Kenya'] },
      ],
      total: 2,
    });

    await ctx.main(vi.fn());

    expect(ctx.db.upsertLocations).toHaveBeenCalledOnce();
    // Seeded before the postings, or the join's foreign key has nothing to
    // point at.
    expect(ctx.db.upsertLocations.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.db.ingestJobs.mock.invocationCallOrder[0],
    );
    expect(logged).toContain('seeding 36 locations');

    const rows = ctx.db.ingestJobs.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0].location_slugs).toEqual(['jp-tokyo']);
    expect(rows[1].location_slugs).toEqual([]);

    expect(logged).toContain(
      '  !! "Nairobi,Kenya" x2 -- unknown country in "Nairobi,Kenya"',
    );
    expect(ctx.db.finishRun.mock.calls[0][3]).toContain('unplaced sites: Nairobi,Kenya x2');
  });

});
