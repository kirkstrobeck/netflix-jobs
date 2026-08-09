import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from './relink-locations.ts';
import { listJobLocations, replaceJobSites, upsertLocations } from '../lib/db.ts';

vi.mock('../lib/db.ts', () => ({
  upsertLocations: vi.fn(async () => 36),
  listJobLocations: vi.fn(async () => []),
  replaceJobSites: vi.fn(async (links: unknown[]) => links.length),
}));

const logged: string[] = [];

beforeEach(() => {
  logged.length = 0;
  // Reset, not clear: mockResolvedValue in one test would otherwise still be
  // the stored board in the next.
  vi.mocked(upsertLocations).mockReset().mockResolvedValue(36);
  vi.mocked(listJobLocations).mockReset().mockResolvedValue([]);
  vi.mocked(replaceJobSites)
    .mockReset()
    .mockImplementation(async (links) => links.length);
  vi.spyOn(console, 'log').mockImplementation((message: string) => {
    logged.push(message);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function job(position_id: number, locations: string[]) {
  return { position_id, locations, location: locations.join(' | ') };
}

describe('relink-locations', () => {
  it('seeds the sites, then rebuilds the join from the stored raw strings', async () => {
    vi.mocked(listJobLocations).mockResolvedValue([
      job(1, ['Tokyo,Japan', 'Seoul,Korea, Republic of']),
      job(2, ['USA - Remote']),
    ]);
    const exit = vi.fn();

    await main(exit);

    expect(upsertLocations).toHaveBeenCalledOnce();
    expect(replaceJobSites).toHaveBeenCalledWith([
      { job_position_id: 1, location_slug: 'jp-tokyo' },
      { job_position_id: 1, location_slug: 'kr-seoul' },
      { job_position_id: 2, location_slug: 'us-remote' },
    ]);
    expect(logged).toContain('seeded 36 locations');
    expect(logged).toContain('linked 3 job/site pairs');
    expect(logged).toContain('sites: every location string is covered by the seed');
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  // The command's whole job is to answer "did the seed edit cover everything",
  // so an uncovered site is a non-zero exit and a named line, not a summary.
  it('names every uncovered string and exits non-zero', async () => {
    vi.mocked(listJobLocations).mockResolvedValue([
      job(1, ['Tokyo,Japan', 'Nairobi,Kenya']),
      job(2, ['Nairobi,Kenya']),
    ]);
    const exit = vi.fn();

    await main(exit);

    expect(replaceJobSites).toHaveBeenCalledWith([
      { job_position_id: 1, location_slug: 'jp-tokyo' },
    ]);
    expect(logged).toContain('  !! "Nairobi,Kenya" x2 -- unknown country in "Nairobi,Kenya"');
    expect(logged).toContain('\n  !! 1 location string(s) not in lib/sites-seed.ts:');
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('defaults to exiting the process', async () => {
    const processExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await main();

    expect(processExit).toHaveBeenCalledExactlyOnceWith(0);
  });
});
