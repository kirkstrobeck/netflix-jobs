import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadIngest, logged, page, resetIngestEnv } from './ingest.harness.ts';

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

const range = (from: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => from + index);

function ids(rows: Array<{ position_id: string }>): string[] {
  return rows.map((row) => row.position_id);
}

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

describe('enumeratePositions', () => {
  it('pages the list endpoint until every position is seen', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage
      .mockResolvedValueOnce(page(range(1, 10), 25))
      .mockResolvedValueOnce(page(range(1, 10), 25))
      .mockResolvedValueOnce(page(range(11, 10), 25))
      .mockResolvedValueOnce(page(range(21, 5), 25));

    await ctx.main(vi.fn());

    // One probe page, then three pages of the relevance sweep.
    expect(ctx.eightfold.fetchListPage).toHaveBeenCalledTimes(4);
    expect(ctx.eightfold.fetchListPage.mock.calls.slice(1)).toEqual([
      [0, 'relevance'],
      [10, 'relevance'],
      [20, 'relevance'],
    ]);
    expect(ids(ctx.db.ingestJobs.mock.calls[0][0])).toHaveLength(25);
    expect(logged).toContain('board reports 25 positions; crawling 25');
    expect(logged).toContain('  relevance page 1: +10 (10/25 unique)');
    expect(logged).toContain('  relevance page 3: +5 (25/25 unique)');
  });

  it('stops a sweep early when a page comes back empty', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage
      .mockResolvedValueOnce(page(range(1, 10), 30))
      .mockResolvedValueOnce(page(range(1, 10), 30))
      .mockResolvedValue(page([], 30));

    await ctx.main(vi.fn());

    // Each of the three sort orders gives up as soon as it hits the empty page.
    expect(ids(ctx.db.ingestJobs.mock.calls[0][0])).toHaveLength(10);
    expect(logged).toContain('  WARNING: enumerated 10 of 30 reported positions');
  });

  it('re-sweeps under the next sort order when positions are missing', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage
      .mockResolvedValueOnce(page(range(1, 10), 12))
      .mockResolvedValueOnce(page(range(1, 10), 12))
      .mockResolvedValueOnce(page(range(1, 10), 12))
      .mockResolvedValueOnce(page(range(3, 10), 12));

    await ctx.main(vi.fn());

    expect(ctx.eightfold.fetchListPage.mock.calls.slice(1)).toEqual([
      [0, 'relevance'],
      [10, 'relevance'],
      [0, 'timestamp'],
    ]);
    expect(logged).toContain('  relevance sweep left 2 unseen; re-sweeping');
    expect(logged).toContain('  timestamp page 1: +10 (12/12 unique)');
    expect(ids(ctx.db.ingestJobs.mock.calls[0][0])).toHaveLength(12);
    expect(logged).not.toContain('  WARNING: enumerated 12 of 12 reported positions');
  });

  it('warns after every sort order still leaves positions unseen', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockResolvedValue(page(range(1, 10), 15));

    await ctx.main(vi.fn());

    // 1 probe + 3 sorts x 2 pages, since each sort re-lists the same 10 rows.
    expect(ctx.eightfold.fetchListPage).toHaveBeenCalledTimes(7);
    expect(logged).toContain('  relevance sweep left 5 unseen; re-sweeping');
    expect(logged).toContain('  timestamp sweep left 5 unseen; re-sweeping');
    expect(logged).toContain('  distance sweep left 5 unseen; re-sweeping');
    expect(logged).toContain('  WARNING: enumerated 10 of 15 reported positions');
    expect(ids(ctx.db.ingestJobs.mock.calls[0][0])).toHaveLength(10);
  });

  it('caps the crawl at MAX_JOBS', async () => {
    const ctx = await loadIngest({ MAX_JOBS: '12' });
    ctx.eightfold.fetchListPage
      .mockResolvedValueOnce(page(range(1, 10), 481))
      .mockResolvedValueOnce(page(range(1, 10), 481))
      .mockResolvedValueOnce(page(range(11, 10), 481));

    await ctx.main(vi.fn());

    expect(logged).toContain('board reports 481 positions; crawling 12');
    // The last page overshoots the cap, so the slice trims it back to 12.
    expect(ids(ctx.db.ingestJobs.mock.calls[0][0])).toEqual(
      range(1, 12).map((id) => String(id)),
    );
    expect(ctx.eightfold.fetchDetail).toHaveBeenCalledTimes(12);
  });

  it('does not let MAX_JOBS raise the crawl above the reported total', async () => {
    const ctx = await loadIngest({ MAX_JOBS: '100' });
    ctx.eightfold.fetchListPage.mockResolvedValue(page(range(1, 3), 3));

    await ctx.main(vi.fn());

    expect(logged).toContain('board reports 3 positions; crawling 3');
    expect(ids(ctx.db.ingestJobs.mock.calls[0][0])).toEqual(['1', '2', '3']);
  });

  it('skips the sweeps entirely when the board reports nothing', async () => {
    const ctx = await loadIngest();
    ctx.eightfold.fetchListPage.mockResolvedValue(page([], 0));

    await ctx.main(vi.fn());

    expect(ctx.eightfold.fetchListPage).toHaveBeenCalledExactlyOnceWith(0);
    expect(logged).toContain('board reports 0 positions; crawling 0');
    expect(logged).toContain('enumerated 0 positions; fetching details');
  });
});
