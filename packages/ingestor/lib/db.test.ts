import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { finishRun, startRun, supabaseUrl } from './db.ts';

const fetchMock = vi.fn();
const originalEnv = { ...process.env };

function ok(body: string, headers: Record<string, string> = {}): Response {
  return {
    ok: true,
    status: 200,
    text: async () => body,
    headers: new Headers(headers),
  } as unknown as Response;
}

function notOk(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
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

describe('supabaseUrl', () => {
  it('strips trailing slashes from the configured url', () => {
    process.env.SUPABASE_URL = 'http://example.test:54321///';
    expect(supabaseUrl()).toBe('http://example.test:54321');
  });

  it('falls back to the local stack default', () => {
    delete process.env.SUPABASE_URL;
    expect(supabaseUrl()).toBe('http://127.0.0.1:54721');
  });
});

describe('startRun', () => {
  it('creates a run row and returns its id', async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify([{ id: 'run-1' }])));

    await expect(startRun()).resolves.toBe('run-1');

    const [url, init] = lastCall();
    expect(url).toBe('http://127.0.0.1:54721/rest/v1/ingest_runs');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ status: 'running' }));
    expect(init.headers).toMatchObject({
      apikey: 'test-key',
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    });
  });

  it('uses the bundled demo service key when none is set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    fetchMock.mockResolvedValue(ok(JSON.stringify([{ id: 'run-1' }])));

    await startRun();
    const headers = lastCall()[1].headers as Record<string, string>;
    expect(headers.apikey).toMatch(/^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./);
  });

  it('throws when the insert returns no rows', async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify([])));
    await expect(startRun()).rejects.toThrow('could not create ingest_runs row');
  });

  it('throws when the response body is empty', async () => {
    // An empty body parses to null, which is the other way the id can go missing.
    fetchMock.mockResolvedValue(ok(''));
    await expect(startRun()).rejects.toThrow('could not create ingest_runs row');
  });

  it('throws with status and body when the request fails', async () => {
    fetchMock.mockResolvedValue(notOk(401, 'no auth'));
    await expect(startRun()).rejects.toThrow(
      'POST /rest/v1/ingest_runs -> 401: no auth',
    );
  });
});

describe('finishRun', () => {
  it('patches the run row with counts and notes', async () => {
    fetchMock.mockResolvedValue(ok(''));

    await finishRun(
      'run-1',
      'succeeded',
      { listed: 481, detailOk: 480, detailFailed: 1, upserted: 481, deactivated: 2 },
      'all good',
    );

    const [url, init] = lastCall();
    expect(url).toBe('http://127.0.0.1:54721/rest/v1/ingest_runs?id=eq.run-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toMatchObject({
      status: 'succeeded',
      listed_count: 481,
      detail_ok_count: 480,
      detail_failed_count: 1,
      upserted_count: 481,
      deactivated_count: 2,
      notes: 'all good',
    });
    expect(JSON.parse(String(init.body)).finished_at).toEqual(expect.any(String));
  });

  it('defaults every missing count to zero', async () => {
    fetchMock.mockResolvedValue(ok(''));

    await finishRun('run-1', 'failed', {}, 'boom');

    expect(JSON.parse(String(lastCall()[1].body))).toMatchObject({
      listed_count: 0,
      detail_ok_count: 0,
      detail_failed_count: 0,
      upserted_count: 0,
      deactivated_count: 0,
    });
  });
});
