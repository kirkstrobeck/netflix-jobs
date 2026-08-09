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

describe('write batching', () => {
  it('splits the rows into WRITE_BATCH-sized calls', async () => {
    const ctx = await loadIngest({ WRITE_BATCH: '2' });
    const positions = Array.from({ length: 5 }, (_, index) => position(index + 1));
    ctx.eightfold.fetchListPage.mockResolvedValue({ positions, total: 5 });
    ctx.eightfold.fetchDetail.mockResolvedValue({});

    await ctx.main(vi.fn());

    expect(ctx.db.ingestJobs.mock.calls.map((call) => call[0].length)).toEqual([2, 2, 1]);
    expect(logged).toContain('  wrote 2/5');
    expect(logged).toContain('  wrote 4/5');
    expect(logged).toContain('  wrote 5/5');
    expect(ctx.db.finishRun.mock.calls[0][2]).toMatchObject({ upserted: 5 });
  });

  it('writes nothing when the board is empty', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockResolvedValue({ positions: [], total: 0 });

    const exit = vi.fn();
    await ctx.main(exit);

    expect(ctx.db.ingestJobs).not.toHaveBeenCalled();
    expect(ctx.db.finishRun.mock.calls[0][2]).toMatchObject({ listed: 0, upserted: 0 });
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });
});
