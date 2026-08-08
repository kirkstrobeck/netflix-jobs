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
  deactivateMissing: vi.fn(async () => 0),
  countJobs: vi.fn(async () => 0),
}));

vi.mock('../lib/revalidate.ts', () => ({
  revalidateWeb: vi.fn(async () => 'ok'),
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
    expect(ctx.revalidate.revalidateWeb).toHaveBeenCalledOnce();
    expect(ctx.db.finishRun).toHaveBeenCalledExactlyOnceWith(
      'run-1',
      'succeeded',
      { listed: 2, detailOk: 2, detailFailed: 0, upserted: 2, deactivated: 3 },
      'transport direct=5 reader=2 | no failures',
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
      'transport direct=0 reader=0 | failures: 2: HTTP 502',
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

  it('marks the run failed and exits non-zero when a phase throws', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockRejectedValue(new Error('board unreachable'));

    const exit = vi.fn();
    await ctx.main(exit);

    expect(ctx.db.ingestJobs).not.toHaveBeenCalled();
    // A failed crawl wrote nothing worth flushing, so the web app keeps the
    // cache it has rather than being told to rebuild from a half-written board.
    expect(ctx.revalidate.revalidateWeb).not.toHaveBeenCalled();
    expect(ctx.db.finishRun).toHaveBeenCalledWith(
      'run-1',
      'failed',
      expect.objectContaining({ listed: 0, upserted: 0, deactivated: 0 }),
      'transport direct=0 reader=0 | failures: board unreachable',
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('stringifies a non-Error run failure', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockRejectedValue('board on fire');

    await ctx.main(vi.fn());

    expect(ctx.db.finishRun).toHaveBeenCalledWith(
      'run-1',
      'failed',
      expect.anything(),
      'transport direct=0 reader=0 | failures: board on fire',
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
