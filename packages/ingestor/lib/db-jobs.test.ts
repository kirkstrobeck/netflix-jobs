import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { countJobs, deactivateMissing, ingestJobs, type JobRow } from './db.ts';

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

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

function row(id: string): JobRow {
  return { position_id: id } as JobRow;
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

describe('ingestJobs', () => {
  it('short-circuits on an empty batch without calling fetch', async () => {
    await expect(ingestJobs([], 'run-1')).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the batch to the ingest_jobs rpc and returns the affected count', async () => {
    fetchMock.mockResolvedValue(ok('42'));
    const rows = [row('1'), row('2')];

    await expect(ingestJobs(rows, 'run-1')).resolves.toBe(42);

    const [url, init] = lastCall();
    expect(url).toBe('http://127.0.0.1:54721/rest/v1/rpc/ingest_jobs');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ payload: rows, run: 'run-1' }));
  });

  it('treats a null rpc result as zero', async () => {
    fetchMock.mockResolvedValue(ok('null'));
    await expect(ingestJobs([row('1')], 'run-1')).resolves.toBe(0);
  });
});

describe('deactivateMissing', () => {
  it('calls the rpc with the run id and returns the affected count', async () => {
    fetchMock.mockResolvedValue(ok('7'));

    await expect(deactivateMissing('run-1')).resolves.toBe(7);

    const [url, init] = lastCall();
    expect(url).toBe('http://127.0.0.1:54721/rest/v1/rpc/deactivate_missing_jobs');
    expect(init.body).toBe(JSON.stringify({ run: 'run-1' }));
  });

  it('treats an empty body as zero', async () => {
    fetchMock.mockResolvedValue(ok(''));
    await expect(deactivateMissing('run-1')).resolves.toBe(0);
  });
});

describe('countJobs', () => {
  it('reads the total out of the content-range header', async () => {
    fetchMock.mockResolvedValue(ok('[]', { 'content-range': '0-0/481' }));

    await expect(countJobs()).resolves.toBe(481);

    const [url, init] = lastCall();
    expect(url).toBe('http://127.0.0.1:54721/rest/v1/jobs?select=position_id');
    expect(init.headers).toMatchObject({ Prefer: 'count=exact', Range: '0-0' });
  });

  it('returns zero when the header is missing or has no total', async () => {
    fetchMock.mockResolvedValue(ok('[]'));
    await expect(countJobs()).resolves.toBe(0);

    fetchMock.mockResolvedValue(ok('[]', { 'content-range': '*/*' }));
    await expect(countJobs()).resolves.toBeNaN();
  });
});
