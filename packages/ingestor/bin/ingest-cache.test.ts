import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadIngest, logged, position, resetIngestEnv } from './ingest.harness.ts';

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

vi.mock('../lib/cache-flush.ts', () => ({ flushCaches: vi.fn() }));

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

// What the crawl tells the web app to throw away. The DECISION -- which digests
// mean which tags -- is lib/cache-diff.test.ts; this file is only about the two
// things the crawl itself is responsible for: the order it reads in, and handing
// the flush what it needs.
describe('cache flush', () => {
  // THE PRIOR DIGESTS ARE READ BEFORE THE WRITES, AND THAT IS THE POINT.
  //
  // Each stored digest carries whether its posting was on the board at the time,
  // and ingest_jobs sets `is_active = true` on conflict -- so after the write
  // every crawled role looks like it was always there. Read in that order, a role
  // that had been deactivated and has just come back reads as unchanged and
  // flushes nothing, when its return is precisely an addition to the board's set.
  // Asserted on call order rather than on a returned value, because the ordering
  // IS the behaviour.
  it('reads the prior digests before anything reactivates a role', async () => {
    const ctx = await loadIngest();
    const order: string[] = [];
    ctx.checksums.readChecksums.mockImplementation(async () => {
      order.push('read');
      return new Map();
    });
    ctx.db.ingestJobs.mockImplementation(async () => {
      order.push('write');
      return 0;
    });
    ctx.eightfold.fetchListPage.mockResolvedValue({ positions: [position(1)], total: 1 });
    ctx.eightfold.fetchDetail.mockResolvedValue({ id: 1, job_description: '<p>Work</p>' });

    await ctx.main(() => {});

    expect(order).toEqual(['read', 'write']);
  });
  it('marks the run failed and exits non-zero when a phase throws', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockRejectedValue(new Error('board unreachable'));

    const exit = vi.fn();
    await ctx.main(exit);

    expect(ctx.db.ingestJobs).not.toHaveBeenCalled();
    // A failed crawl wrote nothing worth flushing, so the web app keeps the
    // cache it has rather than being told to rebuild from a half-written board.
    expect(ctx.cacheFlush.flushCaches).not.toHaveBeenCalled();
    expect(ctx.db.finishRun).toHaveBeenCalledWith(
      'run-1',
      'failed',
      expect.objectContaining({ listed: 0, upserted: 0, deactivated: 0 }),
      'transport direct=0 reader=0 | failures: board unreachable | sites: not reached | cache: not reached',
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
