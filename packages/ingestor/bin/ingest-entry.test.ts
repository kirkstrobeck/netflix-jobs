import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The other half of bin/ingest.ts's last three lines. See bin/entry-point.test.ts
// for the reasoning; this one is separate only because a crawl needs every
// collaborator mocked and vi.mock is hoisted per file.

vi.mock('../lib/eightfold.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/eightfold.ts')>();
  return {
    ...actual,
    fetchListPage: vi.fn(async () => ({ positions: [], total: 0 })),
    fetchDetail: vi.fn(async () => ({})),
  };
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

vi.mock('../lib/revalidate.ts', () => ({ revalidateWeb: vi.fn(async () => 'ok') }));

vi.mock('../lib/cache-flush.ts', () => ({
  flushCaches: vi.fn(async () => ({
    report: { jobIds: [], board: false, added: 0, outcome: 'unchanged' },
    note: 'cache: unchanged | roles=0 board=false added=0',
  })),
}));

vi.mock('../lib/db-checksums.ts', () => ({
  readChecksums: vi.fn(async () => new Map()),
  writeChecksums: vi.fn(async () => undefined),
}));

const argv1 = process.argv[1];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never));
});

afterEach(() => {
  process.argv[1] = argv1;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('ingest as a process entry point', () => {
  it('starts a run when node was pointed at the file', async () => {
    const { startRun } = await import('../lib/db.ts');
    vi.mocked(startRun).mockClear();

    process.argv[1] = fileURLToPath(new URL('./ingest.ts', import.meta.url));
    vi.resetModules();
    await import('./ingest.ts');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(vi.mocked(startRun)).toHaveBeenCalled();
  });

  it('stays inert when some other file is the entry point', async () => {
    const { startRun } = await import('../lib/db.ts');
    vi.mocked(startRun).mockClear();

    process.argv[1] = fileURLToPath(new URL('./somewhere-else.ts', import.meta.url));
    vi.resetModules();
    await import('./ingest.ts');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(vi.mocked(startRun)).not.toHaveBeenCalled();
  });
});
