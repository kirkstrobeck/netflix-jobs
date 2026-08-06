// Shared setup for the bin/ingest tests. Not a test file and not production
// code, so vitest.config.ts keeps it out of the coverage report.
//
// bin/ingest.ts reads DETAIL_CONCURRENCY, WRITE_BATCH and friends at module
// load, so exercising them means resetting the registry and re-importing.

import { vi, type Mock } from 'vitest';

import type { Position } from '../lib/eightfold.ts';

export const logged: string[] = [];

const ENV_KEYS = [
  'DETAIL_CONCURRENCY',
  'READER_CONCURRENCY',
  'READER_SPACING_MS',
  'WRITE_BATCH',
  'MAX_JOBS',
];

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

export type IngestContext = {
  main: (exit?: (code: number) => void) => Promise<void>;
  eightfold: { fetchListPage: Mock; fetchDetail: Mock };
  db: {
    startRun: Mock;
    finishRun: Mock;
    ingestJobs: Mock;
    deactivateMissing: Mock;
    countJobs: Mock;
  };
  http: { configureReader: Mock; transportCounts: Mock };
};

export function position(id: number): Position {
  return { id, name: `Role ${id}`, location: 'Los Gatos, CA' };
}

export function page(ids: number[], total: number): { positions: Position[]; total: number } {
  return { positions: ids.map(position), total };
}

export function resetIngestEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) process.env[key] = value;
  }
}

export async function loadIngest(env: Record<string, string> = {}): Promise<IngestContext> {
  resetIngestEnv();
  Object.assign(process.env, env);
  vi.resetModules();

  const eightfold = (await import('../lib/eightfold.ts')) as unknown as
    IngestContext['eightfold'];
  const db = (await import('../lib/db.ts')) as unknown as IngestContext['db'];
  const http = (await import('../lib/http.ts')) as unknown as IngestContext['http'];
  const ingest = await import('./ingest.ts');

  // resetModules() re-imports bin/ingest.ts but hands back the same mock
  // objects, so calls and stubbed results have to be cleared by hand. Resetting
  // globally would also clear the console spies these tests read back.
  const mocks = [
    eightfold.fetchListPage,
    eightfold.fetchDetail,
    db.startRun,
    db.finishRun,
    db.ingestJobs,
    db.deactivateMissing,
    db.countJobs,
    http.configureReader,
    http.transportCounts,
  ];
  for (const mock of mocks) {
    mock.mockReset();
  }

  eightfold.fetchListPage.mockResolvedValue({ positions: [], total: 0 });
  eightfold.fetchDetail.mockResolvedValue({});
  db.startRun.mockResolvedValue('run-1');
  db.finishRun.mockResolvedValue(undefined);
  db.ingestJobs.mockResolvedValue(0);
  db.deactivateMissing.mockResolvedValue(0);
  db.countJobs.mockResolvedValue(0);
  http.transportCounts.mockReturnValue({ direct: 0, reader: 0 });

  return { main: ingest.main, eightfold, db, http };
}
