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

// Mocked as a unit: the crawl's contract with it is one call at the end. What
// it decides from the checksums is cache-diff.test.ts's business.
vi.mock('../lib/cache-flush.ts', () => ({ flushCaches: vi.fn() }));

// The prior digests, read before the writes. Mocked here so the ORDER of the two
// can be asserted -- reading them after ingest_jobs has set is_active = true is
// the one mistake this arrangement exists to prevent.
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

describe('main', () => {
  it('runs the full crawl and reports success', async () => {
    const ctx = await loadIngest({ READER_CONCURRENCY: '4', READER_SPACING_MS: '1500' });
    ctx.eightfold.fetchListPage.mockResolvedValue({
      positions: [position(1), position(2)],
      total: 2,
    });
    ctx.eightfold.fetchDetail.mockImplementation(async (id: string) => ({
      id: Number(id),
      job_description: '<p>Work here</p>',
    }));
    ctx.db.ingestJobs.mockResolvedValue(2);
    ctx.db.deactivateMissing.mockResolvedValue(3);
    ctx.db.countJobs.mockResolvedValue(481);
    ctx.http.transportCounts.mockReturnValue({ direct: 5, reader: 2 });

    const exit = vi.fn();
    await ctx.main(exit);

    expect(ctx.http.configureReader).toHaveBeenCalledExactlyOnceWith(4, 1500);
    expect(ctx.db.startRun).toHaveBeenCalledOnce();
    expect(ctx.eightfold.fetchDetail).toHaveBeenCalledTimes(2);
    expect(ctx.db.ingestJobs).toHaveBeenCalledOnce();

    const [rows, runId] = ctx.db.ingestJobs.mock.calls[0];
    expect(runId).toBe('run-1');
    expect(rows.map((row: { position_id: string }) => row.position_id)).toEqual(['1', '2']);
    expect(rows[0].description_text).toBe('Work here');

    expect(ctx.db.deactivateMissing).toHaveBeenCalledExactlyOnceWith('run-1');
    // One call, handed the rows, the deactivation count, and the digests read
    // before the writes.
    expect(ctx.cacheFlush.flushCaches).toHaveBeenCalledOnce();
    expect(ctx.cacheFlush.flushCaches.mock.calls[0][1]).toBe(3);
    expect(ctx.cacheFlush.flushCaches.mock.calls[0][2]).toBeInstanceOf(Map);
    expect(ctx.db.finishRun).toHaveBeenCalledExactlyOnceWith(
      'run-1',
      'succeeded',
      { listed: 2, detailOk: 2, detailFailed: 0, upserted: 2, deactivated: 3 },
      'transport direct=5 reader=2 | no failures | sites: all placed | cache: unchanged | roles=0 board=false added=0',
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(logged).toContain('ingest run run-1');
    expect(logged).toContain('enumerated 2 positions; fetching details');
    expect(logged.at(-1)).toContain('"rowsInDb": 481');
  });

  it('keeps going when a detail fetch fails', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockResolvedValue({
      positions: [position(1), position(2)],
      total: 2,
    });
    ctx.eightfold.fetchDetail.mockImplementation(async (id: string) => {
      if (id === '2') throw new Error('HTTP 502');
      return { id: 1, job_description: '<p>Fine</p>' };
    });

    const exit = vi.fn();
    await ctx.main(exit);

    // The failed posting still lands, just with no description.
    const rows = ctx.db.ingestJobs.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[1].description_text).toBe('');
    expect(logged).toContain('  detail 2 FAILED: HTTP 502');
    expect(ctx.db.finishRun).toHaveBeenCalledWith(
      'run-1',
      'succeeded',
      expect.objectContaining({ detailOk: 1, detailFailed: 1 }),
      'transport direct=0 reader=0 | failures: 2: HTTP 502 | sites: all placed | cache: unchanged | roles=0 board=false added=0',
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('stringifies a non-Error detail rejection', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockResolvedValue({ positions: [position(1)], total: 1 });
    ctx.eightfold.fetchDetail.mockRejectedValue('upstream said no');

    await ctx.main(vi.fn());

    expect(logged).toContain('  detail 1 FAILED: upstream said no');
  });

  it('stringifies a non-Error run failure', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockRejectedValue('board on fire');

    await ctx.main(vi.fn());

    expect(ctx.db.finishRun).toHaveBeenCalledWith(
      'run-1',
      'failed',
      expect.anything(),
      'transport direct=0 reader=0 | failures: board on fire | sites: not reached | cache: not reached',
    );
  });

  it('caps the failure note at twenty entries', async () => {
    const ctx = await loadIngest();
    const positions = Array.from({ length: 25 }, (_, index) => position(index + 1));
    ctx.eightfold.fetchListPage.mockResolvedValue({ positions, total: 25 });
    ctx.eightfold.fetchDetail.mockRejectedValue(new Error('nope'));

    await ctx.main(vi.fn());

    const notes = ctx.db.finishRun.mock.calls[0][3] as string;
    expect(notes.split('; ')).toHaveLength(20);
  });

  it('defaults to exiting the process with the run status', async () => {
    const ctx = await loadIngest();
    // Spied, so the worker is never actually torn down.
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    ctx.eightfold.fetchListPage.mockResolvedValue({ positions: [], total: 0 });

    await ctx.main();

    expect(exitSpy).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('logs progress every twenty-five details', async () => {
    const ctx = await loadIngest();
    const positions = Array.from({ length: 25 }, (_, index) => position(index + 1));
    ctx.eightfold.fetchListPage.mockResolvedValue({ positions, total: 25 });
    ctx.eightfold.fetchDetail.mockResolvedValue({ job_description: '<p>x</p>' });

    await ctx.main(vi.fn());

    expect(logged.some((line) => /^ {2}detail 25\/25 \(\d+s\)$/.test(line))).toBe(true);
  });
});
