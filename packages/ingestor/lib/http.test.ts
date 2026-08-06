import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson } from './http.ts';
import { HttpError, send, sleep } from './transport.ts';

vi.mock('./transport.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transport.ts')>();
  return { ...actual, send: vi.fn(), sleep: vi.fn(async () => {}) };
});

const sendMock = vi.mocked(send);
const sleepMock = vi.mocked(sleep);
const logged: string[] = [];

beforeEach(() => {
  sendMock.mockReset();
  sleepMock.mockReset();
  sleepMock.mockResolvedValue(undefined);
  logged.length = 0;
  vi.spyOn(console, 'log').mockImplementation((message: string) => {
    logged.push(message);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchJson', () => {
  it('returns the payload on a first-attempt success', async () => {
    sendMock.mockResolvedValue({ count: 481 });

    await expect(fetchJson('https://example.test/jobs', 'list')).resolves.toEqual({
      count: 481,
    });
    expect(sendMock).toHaveBeenCalledExactlyOnceWith('https://example.test/jobs', 30_000);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('honours an explicit timeout', async () => {
    sendMock.mockResolvedValue({});
    await fetchJson('https://example.test/jobs/1', 'detail', { timeoutMs: 25_000 });
    expect(sendMock).toHaveBeenCalledExactlyOnceWith('https://example.test/jobs/1', 25_000);
  });

  it('retries a transient fault and logs the backoff', async () => {
    sendMock
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValue({ ok: true });

    await expect(fetchJson('https://example.test/jobs', 'list')).resolves.toEqual({
      ok: true,
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledExactlyOnceWith(2_000);
    expect(logged).toContain('  list: socket hang up — retry 1 in 2000ms');
  });

  it('walks the transient backoff ladder and holds at the last rung', async () => {
    sendMock.mockRejectedValue(new HttpError(503, 'list'));

    // 4 attempts by default, so 3 sleeps before the throw.
    await expect(fetchJson('https://example.test/jobs', 'list')).rejects.toThrow('HTTP 503');
    expect(sendMock).toHaveBeenCalledTimes(4);
    expect(sleepMock.mock.calls.flat()).toEqual([2_000, 8_000, 20_000]);
  });

  it('extends the ladder past its length for a long maxAttempts', async () => {
    sendMock.mockRejectedValue(new HttpError(500, 'list'));

    await expect(
      fetchJson('https://example.test/jobs', 'list', { maxAttempts: 6 }),
    ).rejects.toThrow('HTTP 500');
    expect(sleepMock.mock.calls.flat()).toEqual([2_000, 8_000, 20_000, 45_000, 45_000]);
  });

  it('gives a rate limit its own budget and its own delay ladder', async () => {
    sendMock
      .mockRejectedValueOnce(new HttpError(429, 'list'))
      .mockRejectedValueOnce(new HttpError(429, 'list'))
      .mockResolvedValue({ ok: true });

    await expect(fetchJson('https://example.test/jobs', 'list')).resolves.toEqual({
      ok: true,
    });
    expect(sleepMock.mock.calls.flat()).toEqual([5_000, 15_000]);
  });

  it('stops once the rate-limit budget is spent and caps the delay', async () => {
    sendMock.mockRejectedValue(new HttpError(429, 'list'));

    await expect(fetchJson('https://example.test/jobs', 'list')).rejects.toThrow('HTTP 429');
    // 6 ladder rungs, then a 7th hit exceeds the budget and rethrows.
    expect(sendMock).toHaveBeenCalledTimes(7);
    expect(sleepMock.mock.calls.flat()).toEqual([
      5_000, 15_000, 30_000, 60_000, 90_000, 120_000,
    ]);
  });

  it('retries a 403 immediately so the demoted transport is used at once', async () => {
    sendMock
      .mockRejectedValueOnce(new HttpError(403, 'list'))
      .mockResolvedValue({ ok: true });

    await expect(fetchJson('https://example.test/jobs', 'list')).resolves.toEqual({
      ok: true,
    });
    expect(sleepMock).toHaveBeenCalledExactlyOnceWith(0);
    expect(logged).toContain('  list: list: HTTP 403 — retry 1 in 0ms');
  });

  it('throws a non-retryable status without retrying', async () => {
    sendMock.mockRejectedValue(new HttpError(404, 'detail 7'));

    await expect(fetchJson('https://example.test/jobs/7', 'detail 7')).rejects.toThrow(
      'HTTP 404',
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('stringifies a non-Error rejection in the retry log', async () => {
    sendMock.mockRejectedValueOnce('plain string failure').mockResolvedValue({});

    await fetchJson('https://example.test/jobs', 'list');
    expect(logged).toContain('  list: plain string failure — retry 1 in 2000ms');
  });
});

describe('re-exports', () => {
  it('exposes the transport controls through the http module', async () => {
    const http = await import('./http.ts');
    expect(typeof http.configureReader).toBe('function');
    expect(typeof http.currentTransport).toBe('function');
    expect(typeof http.transportCounts).toBe('function');
    expect(typeof http.resetTransportState).toBe('function');
  });
});
