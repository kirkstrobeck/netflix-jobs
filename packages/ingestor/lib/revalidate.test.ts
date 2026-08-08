import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidateUrl, revalidateWeb } from './revalidate.ts';

const fetchMock = vi.fn();
const originalEnv = { ...process.env };
const logged: string[] = [];
const errored: string[] = [];
const warned: string[] = [];

function ok(body: string): Response {
  return { ok: true, status: 200, text: async () => body } as unknown as Response;
}

function notOk(status: number, body: string): Response {
  return { ok: false, status, text: async () => body } as unknown as Response;
}

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

function sentBody(): unknown {
  return JSON.parse(lastCall()[1].body as string);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  logged.length = 0;
  errored.length = 0;
  warned.length = 0;
  vi.spyOn(console, 'log').mockImplementation((message: string) => void logged.push(message));
  vi.spyOn(console, 'error').mockImplementation((message: string) => void errored.push(message));
  vi.spyOn(console, 'warn').mockImplementation((message: string) => void warned.push(message));
  process.env.REVALIDATE_SECRET = 'shared-secret';
  delete process.env.REVALIDATE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('revalidateUrl', () => {
  it('defaults to the local web app', () => {
    expect(revalidateUrl()).toBe('http://127.0.0.1:3000/api/revalidate');
  });

  it('uses REVALIDATE_URL when set', () => {
    process.env.REVALIDATE_URL = 'https://jobs.example.com/api/revalidate';
    expect(revalidateUrl()).toBe('https://jobs.example.com/api/revalidate');
  });
});

describe('revalidateWeb', () => {
  it('posts the secret and an empty body for a whole-board flush', async () => {
    fetchMock.mockResolvedValue(ok('{"revalidated":true,"tags":["jobs-board"]}'));

    await expect(revalidateWeb()).resolves.toBe('ok');

    const [url, init] = lastCall();
    expect(url).toBe('http://127.0.0.1:3000/api/revalidate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe('shared-secret');
    expect(sentBody()).toEqual({});
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(logged.at(-1)).toContain('jobs-board');
  });

  it('names job ids when it is given them', async () => {
    fetchMock.mockResolvedValue(ok('{"revalidated":true}'));

    await expect(revalidateWeb(['JR41912'])).resolves.toBe('ok');

    expect(sentBody()).toEqual({ jobIds: ['JR41912'] });
  });

  it('posts to REVALIDATE_URL when set', async () => {
    process.env.REVALIDATE_URL = 'https://jobs.example.com/api/revalidate';
    fetchMock.mockResolvedValue(ok('{}'));

    await revalidateWeb();

    expect(lastCall()[0]).toBe('https://jobs.example.com/api/revalidate');
  });

  // The whole point of this module: the rows are already committed, so an
  // unreachable or unhappy web app is a loud log line, never a thrown error.
  it('reports a non-2xx response as failed without throwing', async () => {
    fetchMock.mockResolvedValue(notOk(401, 'unauthorized'));

    await expect(revalidateWeb()).resolves.toBe('failed');

    expect(errored[0]).toContain('REVALIDATE FAILED');
    expect(errored[0]).toContain('401: unauthorized');
    expect(errored[1]).toContain('The crawl is written');
  });

  it('reports a network error as failed without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3000'));

    await expect(revalidateWeb()).resolves.toBe('failed');

    expect(errored[0]).toContain('connect ECONNREFUSED');
  });

  it('stringifies a non-Error rejection', async () => {
    fetchMock.mockRejectedValue('the socket gave up');

    await expect(revalidateWeb()).resolves.toBe('failed');

    expect(errored[0]).toContain('the socket gave up');
  });

  it('truncates a long response body in the log', async () => {
    fetchMock.mockResolvedValue(notOk(500, 'x'.repeat(1000)));

    await revalidateWeb();

    expect(errored[0]).toContain('x'.repeat(300));
    expect(errored[0]).not.toContain('x'.repeat(301));
  });

  // Unset secret is a configuration state, not a failure: warn and skip rather
  // than post an unauthenticated call the endpoint would 401 anyway.
  it('skips with a warning when REVALIDATE_SECRET is unset', async () => {
    delete process.env.REVALIDATE_SECRET;

    await expect(revalidateWeb()).resolves.toBe('skipped');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warned[0]).toContain('REVALIDATE_SECRET is unset');
  });
});
