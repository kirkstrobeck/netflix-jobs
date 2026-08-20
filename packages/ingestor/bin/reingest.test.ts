import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/reingest-creds.ts', () => ({
  localCreds: vi.fn(),
  hostedCreds: vi.fn(),
}));
vi.mock('../lib/reingest-counts.ts', () => ({
  queryCounts: vi.fn(),
}));
vi.mock('../lib/reingest-compare.ts', () => ({
  compare: vi.fn(),
  formatTable: vi.fn(() => 'table\nAGREE'),
}));
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));
vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { localCreds, hostedCreds } from '../lib/reingest-creds.ts';
import { queryCounts } from '../lib/reingest-counts.ts';
import { compare, formatTable } from '../lib/reingest-compare.ts';

const CREDS = { url: 'http://test', serviceRoleKey: 'key' };
const COUNTS = { activeRoles: 10, locationLinks: 20, rolesWithCoords: 5 };
const OK_SPAWN = { status: 0, stdout: 'ok output', stderr: '', pid: 1, output: [], signal: null };
const AGREE_VERDICT = { agree: true, local: COUNTS, hosted: COUNTS };

const argv1 = process.argv[1];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(localCreds).mockReturnValue(CREDS);
  vi.mocked(hostedCreds).mockResolvedValue(CREDS);
  (vi.mocked(spawnSync) as any).mockReturnValue(OK_SPAWN);
  vi.mocked(queryCounts).mockResolvedValue(COUNTS);
  vi.mocked(compare).mockReturnValue(AGREE_VERDICT);
  vi.mocked(writeFileSync).mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  process.argv[1] = argv1;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('main', () => {
  it('exits 0 when both ingests succeed and counts agree', async () => {
    const { main } = await import('./reingest.ts');
    const exit = vi.fn();
    await main(exit);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 when local ingest returns non-zero', async () => {
    (vi.mocked(spawnSync) as any).mockReturnValueOnce({ ...OK_SPAWN, status: 1 });
    const { main } = await import('./reingest.ts');
    const exit = vi.fn();
    await main(exit);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 when hosted ingest returns non-zero', async () => {
    (vi.mocked(spawnSync) as any)
      .mockReturnValueOnce(OK_SPAWN)
      .mockReturnValueOnce({ ...OK_SPAWN, status: 2 });
    const { main } = await import('./reingest.ts');
    const exit = vi.fn();
    await main(exit);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 when counts disagree', async () => {
    vi.mocked(compare).mockReturnValue({ agree: false, local: COUNTS, hosted: COUNTS });
    const { main } = await import('./reingest.ts');
    const exit = vi.fn();
    await main(exit);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('propagates errors thrown by spawnSync (e.g. ENOENT)', async () => {
    (vi.mocked(spawnSync) as any).mockReturnValueOnce({
      ...OK_SPAWN,
      error: new Error('spawn ENOENT'),
    });
    const { main } = await import('./reingest.ts');
    const exit = vi.fn();
    await expect(main(exit)).rejects.toThrow('spawn ENOENT');
  });

  it('writes ingest output to the log file', async () => {
    const { main } = await import('./reingest.ts');
    await main(vi.fn());
    expect(vi.mocked(writeFileSync)).toHaveBeenCalledTimes(2);
  });

  it('uses /home/agent/.pnpm when PNPM_HOME is not set in env', async () => {
    const saved = process.env.PNPM_HOME;
    delete process.env.PNPM_HOME;
    const { main } = await import('./reingest.ts');
    await main(vi.fn());
    const envPassed = (vi.mocked(spawnSync) as any).mock.calls[0][2].env as Record<string, string>;
    expect(envPassed['PNPM_HOME']).toBe('/home/agent/.pnpm');
    process.env.PNPM_HOME = saved;
  });

  it('returns 1 when spawnSync gives a null status (e.g. SIGKILL)', async () => {
    (vi.mocked(spawnSync) as any)
      .mockReturnValueOnce({ ...OK_SPAWN, status: null, stdout: '', stderr: '' });
    const { main } = await import('./reingest.ts');
    const exit = vi.fn();
    await main(exit);
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('entry point guard', () => {
  it('calls main when node is pointed at reingest.ts', async () => {
    process.argv[1] = fileURLToPath(new URL('./reingest.ts', import.meta.url));
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.resetModules();
    await import('./reingest.ts');
    await new Promise((r) => setTimeout(r, 0));
    const { localCreds: lc } = await import('../lib/reingest-creds.ts');
    expect(vi.mocked(lc)).toHaveBeenCalled();
  });

  it('stays inert when another file is the entry point', async () => {
    process.argv[1] = fileURLToPath(new URL('./ingest.ts', import.meta.url));
    vi.resetModules();
    // Import the mocked creds before reingest.ts so we can clear any prior calls
    const { localCreds: lc } = await import('../lib/reingest-creds.ts');
    vi.mocked(lc).mockClear();
    await import('./reingest.ts');
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(lc)).not.toHaveBeenCalled();
  });
});
