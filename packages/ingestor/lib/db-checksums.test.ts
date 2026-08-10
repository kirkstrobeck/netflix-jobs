import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readChecksums, writeChecksums } from './db-checksums.ts';

const fetchMock = vi.fn();
const originalEnv = { ...process.env };

function ok(body: string): Response {
  return { ok: true, status: 200, text: async () => body } as unknown as Response;
}

function notOk(status: number, body: string): Response {
  return { ok: false, status, text: async () => body } as unknown as Response;
}

function lastCall(): [string, RequestInit & { headers: Record<string, string> }] {
  return fetchMock.mock.calls.at(-1) as never;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.SUPABASE_URL = 'http://127.0.0.1:54721';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe('readChecksums', () => {
  it('keys the stored digests by position id and carries is_active in', async () => {
    fetchMock.mockResolvedValue(
      ok(
        JSON.stringify([
          {
            position_id: 1,
            display_job_id: 'JR00001',
            board_checksum: 'aaaa',
            content_checksum: 'bbbb',
            jobs: { is_active: true },
          },
        ]),
      ),
    );

    const prior = await readChecksums();

    expect(prior.get(1)).toEqual({
      position_id: 1,
      display_job_id: 'JR00001',
      board_checksum: 'aaaa',
      content_checksum: 'bbbb',
      wasActive: true,
    });
  });

  // A checksum whose posting is gone must not read as "unchanged": a role that
  // comes back is an addition to the board's set. Embedded through the foreign
  // key, so it costs no second round trip.
  it('asks for is_active through the join and reads a missing one as inactive', async () => {
    fetchMock.mockResolvedValue(
      ok(
        JSON.stringify([
          {
            position_id: 2,
            display_job_id: null,
            board_checksum: 'cc',
            content_checksum: 'dd',
            jobs: null,
          },
        ]),
      ),
    );

    const prior = await readChecksums();

    expect(lastCall()[0]).toContain('jobs(is_active)');
    expect(prior.get(2)?.wasActive).toBe(false);
  });

  // The whole table has to arrive; PostgREST caps a range-less read well under
  // 481 rows and a truncated read would silently look like a board of additions.
  it('reads past the default row cap', async () => {
    fetchMock.mockResolvedValue(ok('[]'));

    await readChecksums();

    expect(lastCall()[1].headers.Range).toBe('0-99999');
  });

  // The first-run answer, and not an error: every role then reads as new, which
  // is right, since nothing rendered from these rows has ever been cached.
  it('is an empty map when nothing has ever been stored', async () => {
    fetchMock.mockResolvedValue(ok(''));

    await expect(readChecksums()).resolves.toEqual(new Map());
  });

  it('throws with the status and the body when the read fails', async () => {
    fetchMock.mockResolvedValue(notOk(401, 'no key'));

    await expect(readChecksums()).rejects.toThrow('401: no key');
  });
});

describe('writeChecksums', () => {
  it('upserts every row in one call and stamps it', async () => {
    fetchMock.mockResolvedValue(ok(''));

    const written = await writeChecksums([
      { position_id: 1, display_job_id: 'JR00001', board_checksum: 'a', content_checksum: 'b' },
      { position_id: 2, display_job_id: 'JR00002', board_checksum: 'c', content_checksum: 'd' },
    ]);

    expect(written).toBe(2);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = lastCall();
    expect(url).toBe('http://127.0.0.1:54721/rest/v1/job_checksums');
    expect(init.headers.Prefer).toContain('resolution=merge-duplicates');
    expect(JSON.parse(init.body as string)[0]).toMatchObject({
      position_id: 1,
      board_checksum: 'a',
      updated_at: expect.any(String),
    });
  });

  it('does not call out at all for an empty list', async () => {
    await expect(writeChecksums([])).resolves.toBe(0);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
