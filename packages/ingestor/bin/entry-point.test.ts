import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Both bin/ scripts end with the same three lines: run main() when this file is
// the thing node was pointed at, and stay silent when it was merely imported.
// Every other test in this package imports them, so only the silent half was
// ever exercised -- the half that actually runs the command was carried by a
// coverage-ignore comment instead of by a test.
//
// It is reachable. `process.argv[1]` is what the guard compares against, and a
// test can set it. Pointing it at the module's own path and re-importing makes
// the file the entry point by the only definition the code has.

vi.mock('../lib/db.ts', () => ({
  upsertLocations: vi.fn(async () => 0),
  listJobLocations: vi.fn(async () => []),
  replaceJobSites: vi.fn(async () => 0),
}));

const argv1 = process.argv[1];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  // Run as the entry point, main() takes its default exit -- the real
  // process.exit -- and takes the test runner down with it. The default is the
  // point here, so it is stubbed rather than passed around.
  vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never));
});

afterEach(() => {
  process.argv[1] = argv1;
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadAsEntryPoint(specifier: string, url: string): Promise<void> {
  process.argv[1] = fileURLToPath(new URL(url, import.meta.url));
  vi.resetModules();
  await import(specifier);
  // main() is launched un-awaited by design -- the guard is `void main()` -- so
  // give the microtask queue the turn it needs before asserting on the effect.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('relink-locations as a process entry point', () => {
  it('runs the relink when node was pointed at the file', async () => {
    const { upsertLocations } = await import('../lib/db.ts');
    vi.mocked(upsertLocations).mockClear();

    await loadAsEntryPoint('./relink-locations.ts', './relink-locations.ts');

    expect(vi.mocked(upsertLocations)).toHaveBeenCalled();
  });

  it('stays inert when some other file is the entry point', async () => {
    const { upsertLocations } = await import('../lib/db.ts');
    vi.mocked(upsertLocations).mockClear();

    process.argv[1] = fileURLToPath(new URL('./somewhere-else.ts', import.meta.url));
    vi.resetModules();
    await import('./relink-locations.ts');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(vi.mocked(upsertLocations)).not.toHaveBeenCalled();
  });
});
