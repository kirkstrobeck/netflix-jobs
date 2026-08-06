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
const READER = 'https://r.jina.ai/';
// The module spends one request checking direct again after this many reader calls.
const RETRY_DIRECT_AFTER = 50;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

async function demoteToReader(): Promise<void> {
  fetchMock.mockResolvedValue(jsonResponse('Request blocked', 403));
  await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
  await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
  await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
  expect(currentTransport()).toBe('reader');
  fetchMock.mockReset();
}

async function sendTimes(count: number): Promise<void> {
  const sent = { count: 0 };
  while (sent.count < count) {
    await send('https://example.test/jobs', 1_000);
    sent.count += 1;
  }
}

/** Burns the reader calls that sit between demotion and the next direct probe. */
async function runUpToProbe(): Promise<void> {
  fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
  await sendTimes(RETRY_DIRECT_AFTER - 1);
  expect(transportCounts()).toEqual({ direct: 0, reader: RETRY_DIRECT_AFTER - 1 });
  expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${READER}https://example.test/jobs`);
  fetchMock.mockReset();
}

beforeEach(async () => {
  resetTransportState();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  logged.length = 0;
  vi.spyOn(console, 'log').mockImplementation((message: string) => {
    logged.push(message);
  });
  await demoteToReader();
  configureReader(2, 0);
  await runUpToProbe();
  // Drop the setup's demotion log so each test asserts only on its own output.
  logged.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('direct re-probe', () => {
  it('sends the 50th call over direct and stays there when the block has lifted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await expect(send('https://example.test/jobs', 1_000)).resolves.toEqual({ ok: true });

    // The probe goes to the bare url, not through the reader prefix.
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/jobs');
    expect(currentTransport()).toBe('direct');
    expect(transportCounts()).toEqual({ direct: 1, reader: RETRY_DIRECT_AFTER - 1 });
    expect(logged).toContain('  transport: direct is unblocked again, switching back');
  });

  it('stays on the reader when the probe is still blocked', async () => {
    fetchMock.mockResolvedValue(jsonResponse('Request blocked', 403));

    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');

    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/jobs');
    // Already demoted, so the block streak must not re-announce the switch.
    expect(currentTransport()).toBe('reader');
    expect(logged).not.toContain(
      '  transport: WAF-blocked on direct, switching to reader proxy',
    );
  });

  it('resumes reader traffic and re-probes on the next interval', async () => {
    fetchMock.mockResolvedValue(jsonResponse('Request blocked', 403));
    await expect(send('https://example.test/jobs', 1_000)).rejects.toThrow('HTTP 403');
    fetchMock.mockReset();

    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await send('https://example.test/jobs', 1_000);
    expect(fetchMock.mock.calls[0][0]).toBe(`${READER}https://example.test/jobs`);

    // The probe counter restarted, so a full interval must pass before the next one.
    await sendTimes(RETRY_DIRECT_AFTER - 1);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('https://example.test/jobs');
    expect(currentTransport()).toBe('direct');
  });

  it('does not probe while direct is already the active transport', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await send('https://example.test/jobs', 1_000);
    expect(currentTransport()).toBe('direct');
    fetchMock.mockReset();

    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await sendTimes(RETRY_DIRECT_AFTER + 2);

    const targets = new Set(fetchMock.mock.calls.map((call) => call[0]));
    expect(targets).toEqual(new Set(['https://example.test/jobs']));
    expect(logged.filter((line) => line.includes('unblocked again'))).toHaveLength(1);
  });
});
