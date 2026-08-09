import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listJobLocations, replaceJobSites, upsertLocations } from './db.ts';
import { seedRows } from './sites.ts';

const fetchMock = vi.fn();
const originalEnv = { ...process.env };

function ok(body: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

function calls(): Array<[string, RequestInit]> {
  return fetchMock.mock.calls as Array<[string, RequestInit]>;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok(''));
  vi.stubGlobal('fetch', fetchMock);
  process.env.SUPABASE_URL = 'http://127.0.0.1:54721';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe('upsertLocations', () => {
  it('upserts the seed and stamps every row as touched', async () => {
    await expect(upsertLocations(seedRows())).resolves.toBe(36);

    const [url, init] = calls()[0];
    expect(url).toBe('http://127.0.0.1:54721/rest/v1/locations');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Prefer: 'resolution=merge-duplicates,return=minimal',
    });

    const body = JSON.parse(String(init.body)) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(36);
    expect(body.every((row) => typeof row.updated_at === 'string')).toBe(true);
  });

  it('writes nothing when there is nothing to write', async () => {
    await expect(upsertLocations([])).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('listJobLocations', () => {
  it('reads only the columns the site join is derived from', async () => {
    fetchMock.mockResolvedValue(
      ok(JSON.stringify([{ position_id: 1, locations: ['Tokyo,Japan'], location: 'Tokyo,Japan' }])),
    );

    await expect(listJobLocations()).resolves.toEqual([
      { position_id: 1, locations: ['Tokyo,Japan'], location: 'Tokyo,Japan' },
    ]);

    const [url, init] = calls()[0];
    expect(url).toContain('/rest/v1/jobs?select=position_id,locations,location');
    expect(init.method).toBe('GET');
  });

  it('reads an empty body as no postings', async () => {
    await expect(listJobLocations()).resolves.toEqual([]);
  });
});

describe('replaceJobSites', () => {
  it('clears the join before writing it back', async () => {
    await expect(
      replaceJobSites([{ job_position_id: 1, location_slug: 'jp-tokyo' }]),
    ).resolves.toBe(1);

    expect(calls()[0][0]).toBe(
      'http://127.0.0.1:54721/rest/v1/job_locations?job_position_id=gt.0',
    );
    expect(calls()[0][1].method).toBe('DELETE');
    expect(calls()[1][1].method).toBe('POST');
    expect(JSON.parse(String(calls()[1][1].body))).toEqual([
      { job_position_id: 1, location_slug: 'jp-tokyo' },
    ]);
  });

  // Still a DELETE: no links is a real answer, and leaving the old ones behind
  // would make the join say something the postings no longer do.
  it('clears the join even when there is nothing to write back', async () => {
    await expect(replaceJobSites([])).resolves.toBe(0);

    expect(calls()).toHaveLength(1);
    expect(calls()[0][1].method).toBe('DELETE');
  });
});
