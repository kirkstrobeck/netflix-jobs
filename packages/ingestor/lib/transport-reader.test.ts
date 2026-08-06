import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configureReader,
  currentTransport,
  resetTransportState,
  send,
  transportCounts,
} from './transport.ts';

const fetchMock = vi.fn();
const READER = 'https://r.jina.ai/';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

/** Three consecutive 403s is what demotes the module onto the reader proxy. */
async function demoteToReader(): Promise<void> {
  fetchMock.mockResolvedValue(jsonResponse('Request blocked', 403));
  await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
  await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
  await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
  expect(currentTransport()).toBe('reader');
  fetchMock.mockReset();
}

beforeEach(async () => {
  resetTransportState();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await demoteToReader();
  // No spacing by default so the suite does not spend its time asleep.
  configureReader(2, 0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('send over the reader proxy', () => {
  it('prefixes the url and asks for a raw passthrough', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 481 }));

    await expect(send('https://example.test/jobs', 1_000)).resolves.toEqual({ count: 481 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${READER}https://example.test/jobs`);
    expect(init.headers).toMatchObject({
      'x-respond-with': 'text',
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://explore.jobs.netflix.net/careers',
    });
  });

  it('counts reader calls separately from direct calls', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await send('https://example.test/a', 1_000);
    await send('https://example.test/b', 1_000);

    expect(transportCounts()).toEqual({ direct: 0, reader: 2 });
  });

  it('unwraps the reader envelope', async () => {
    const inner = JSON.stringify({ positions: [{ id: 1 }], count: 1 });
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 200, status: 20_000, data: { text: inner } }),
    );

    await expect(send('https://example.test/jobs', 1_000)).resolves.toEqual({
      positions: [{ id: 1 }],
      count: 1,
    });
  });

  it('passes a verbatim body through untouched', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ positions: [], count: 0 }));

    await expect(send('https://example.test/jobs', 1_000)).resolves.toEqual({
      positions: [],
      count: 0,
    });
  });

  it('leaves an envelope-shaped payload alone when data.text is not a string', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 200, data: { text: 42 } }));
    await expect(send('https://example.test/jobs', 1_000)).resolves.toEqual({
      code: 200,
      data: { text: 42 },
    });

    fetchMock.mockResolvedValue(jsonResponse({ code: 200, data: {} }));
    await expect(send('https://example.test/jobs', 1_000)).resolves.toEqual({
      code: 200,
      data: {},
    });
  });

  it('leaves a null body alone', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null));
    await expect(send('https://example.test/jobs', 1_000)).resolves.toBeNull();
  });

  it('propagates a reader failure without touching the direct block streak', async () => {
    fetchMock.mockResolvedValue(jsonResponse('slow down', 429));

    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow(
      `${READER}https://example.test/jobs: HTTP 429`,
    );
    expect(currentTransport()).toBe('reader');
    expect(transportCounts()).toEqual({ direct: 0, reader: 0 });
  });
});

describe('reader gating', () => {
  it('spaces successive sends by the configured gap', async () => {
    configureReader(2, 60);
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const started = Date.now();
    await Promise.all([
      send('https://example.test/a', 1_000),
      send('https://example.test/b', 1_000),
    ]);

    // The second send has to wait out the gap the first one reserved.
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(transportCounts()).toEqual({ direct: 0, reader: 2 });
  });

  it('holds concurrent sends to the configured concurrency', async () => {
    configureReader(1, 0);
    const inFlight = { now: 0, peak: 0 };
    fetchMock.mockImplementation(async () => {
      inFlight.now += 1;
      inFlight.peak = Math.max(inFlight.peak, inFlight.now);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight.now -= 1;
      return jsonResponse({ ok: true });
    });

    await Promise.all([
      send('https://example.test/a', 1_000),
      send('https://example.test/b', 1_000),
      send('https://example.test/c', 1_000),
    ]);

    expect(inFlight.peak).toBe(1);
    expect(transportCounts()).toEqual({ direct: 0, reader: 3 });
  });
});
