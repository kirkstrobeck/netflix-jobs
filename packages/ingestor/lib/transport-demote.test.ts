import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configureReader,
  currentTransport,
  resetTransportState,
  send,
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

describe('demotion to the reader proxy', () => {
  it('switches after three consecutive 403s', async () => {
    fetchMock.mockResolvedValue(jsonResponse('Request blocked', 403));

    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    expect(currentTransport()).toBe('direct');

    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    expect(currentTransport()).toBe('direct');

    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    expect(currentTransport()).toBe('reader');
    expect(logged).toContain(
      '  transport: WAF-blocked on direct, switching to reader proxy',
    );
  });

  it('resets the streak on any successful direct call', async () => {
    fetchMock.mockResolvedValue(jsonResponse('blocked', 403));
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');

    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await send('https://example.test/jobs', 1_000);

    // Streak cleared, so the next two 403s must not be enough to demote.
    fetchMock.mockResolvedValue(jsonResponse('blocked', 403));
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    expect(currentTransport()).toBe('direct');
  });

  it('does not demote on a non-403 failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse('boom', 500));
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 500');
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 500');
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 500');
    expect(currentTransport()).toBe('direct');
  });
});

describe('resetTransportState', () => {
  it('returns transport, counts and reader gating to their defaults', async () => {
    fetchMock.mockResolvedValue(jsonResponse('blocked', 403));
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    configureReader(5, 10);
    expect(currentTransport()).toBe('reader');

    resetTransportState();

    expect(currentTransport()).toBe('direct');
    expect(transportCounts()).toEqual({ direct: 0, reader: 0 });
  });
});
