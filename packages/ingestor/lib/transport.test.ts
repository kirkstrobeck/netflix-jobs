import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HttpError,
  currentTransport,
  isBlocked,
  isRateLimited,
  isRetryable,
  resetTransportState,
  send,
  sleep,
  transportCounts,
} from './transport.ts';

const fetchMock = vi.fn();
const logged: string[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => {
  resetTransportState();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  logged.length = 0;
  vi.spyOn(console, 'log').mockImplementation((message: string) => {
    logged.push(message);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('error classifiers', () => {
  it('flags 403 as blocked only', () => {
    const err = new HttpError(403, 'https://example.test');
    expect(err.message).toBe('https://example.test: HTTP 403');
    expect(err.status).toBe(403);
    expect(isBlocked(err)).toBe(true);
    expect(isRateLimited(err)).toBe(false);
    expect(isRetryable(err)).toBe(false);
  });

  it('flags 429 as rate limited and retryable', () => {
    const err = new HttpError(429, 'https://example.test');
    expect(isRateLimited(err)).toBe(true);
    expect(isBlocked(err)).toBe(false);
    expect(isRetryable(err)).toBe(true);
  });

  it('treats the 5xx family as retryable', () => {
    expect([500, 502, 503, 504].map((s) => isRetryable(new HttpError(s, 'x')))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isRetryable(new HttpError(404, 'x'))).toBe(false);
    expect(isRetryable(new HttpError(418, 'x'))).toBe(false);
  });

  it('treats non-HttpError failures as retryable network faults', () => {
    expect(isRetryable(new Error('socket hang up'))).toBe(true);
    expect(isRetryable('nope')).toBe(true);
    expect(isBlocked(new Error('403'))).toBe(false);
    expect(isRateLimited(null)).toBe(false);
  });
});

describe('sleep', () => {
  it('resolves after the requested delay', async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });
});

describe('module state', () => {
  it('starts on direct with zeroed counts', () => {
    expect(currentTransport()).toBe('direct');
    expect(transportCounts()).toEqual({ direct: 0, reader: 0 });
  });

  it('returns a copy of the counts rather than the live object', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await send('https://example.test/jobs', 1_000);

    const snapshot = transportCounts();
    expect(snapshot).toEqual({ direct: 1, reader: 0 });
    snapshot.direct = 99;
    expect(transportCounts()).toEqual({ direct: 1, reader: 0 });
  });
});

describe('send over direct', () => {
  it('fetches the url unwrapped and counts the call', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 481 }));

    await expect(send('https://example.test/jobs', 1_000)).resolves.toEqual({ count: 481 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.test/jobs');
    expect(init.redirect).toBe('follow');
    expect(init.headers).toMatchObject({
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://explore.jobs.netflix.net/careers',
    });
    // Direct requests must not ask the reader for a raw passthrough.
    expect(init.headers).not.toHaveProperty('x-respond-with');
    expect(transportCounts()).toEqual({ direct: 1, reader: 0 });
  });

  it('picks a user agent from the pool', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await send('https://example.test/jobs', 1_000);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('Mozilla/5.0');
  });

  it('falls back to the first user agent if the index overruns the pool', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    // Math.random() never actually returns 1; this forces the guard's other branch.
    vi.spyOn(Math, 'random').mockReturnValue(1);

    await send('https://example.test/jobs', 1_000);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toContain(
      'Macintosh; Intel Mac OS X 10_15_7',
    );
  });

  it('throws an HttpError for a non-ok response and does not count it', async () => {
    fetchMock.mockResolvedValue(jsonResponse('server exploded', 500));

    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow(
      'https://example.test/jobs: HTTP 500',
    );
    expect(transportCounts()).toEqual({ direct: 0, reader: 0 });
    expect(currentTransport()).toBe('direct');
  });

  it('aborts the request once the timeout elapses', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    await expect(send('https://example.test/jobs', 5)).rejects.toThrow('aborted');
  });
});
