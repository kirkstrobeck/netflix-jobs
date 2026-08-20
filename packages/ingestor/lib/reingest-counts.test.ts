import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCount, queryCounts } from './reingest-counts.ts';

const fetchMock = vi.fn();

function countResponse(total: number, status = 200): Response {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-range': `0-0/${total}` }),
  } as unknown as Response;
}

function failResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: new Headers(),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCount', () => {
  it('returns the total from a 200 response', async () => {
    fetchMock.mockResolvedValue(countResponse(509));
    await expect(fetchCount('http://db', 'key', 'jobs?is_active=eq.true')).resolves.toBe(509);
  });

  it('accepts a 206 partial-content response', async () => {
    fetchMock.mockResolvedValue(countResponse(42, 206));
    await expect(fetchCount('http://db', 'key', 'jobs')).resolves.toBe(42);
  });

  it('throws on a non-OK response that is not 206', async () => {
    fetchMock.mockResolvedValue(failResponse(403));
    await expect(fetchCount('http://db', 'key', 'jobs')).rejects.toThrow('count query failed (403)');
  });

  it('throws when content-range is unparseable', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-range': 'garbage' }),
    } as unknown as Response);
    await expect(fetchCount('http://db', 'key', 'jobs')).rejects.toThrow('unparseable content-range');
  });

  it('treats a missing content-range header as an empty string (unparseable)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(), // no content-range header → get() returns null → falls back to ''
    } as unknown as Response);
    await expect(fetchCount('http://db', 'key', 'jobs')).rejects.toThrow('unparseable content-range');
  });

  it('sends apikey and auth headers with count preferences', async () => {
    fetchMock.mockResolvedValue(countResponse(1));
    await fetchCount('http://db', 'sk', 'jobs?is_active=eq.true');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/rest/v1/jobs');
    const headers = init.headers as Record<string, string>;
    expect(headers['apikey']).toBe('sk');
    expect(headers['Prefer']).toBe('count=exact');
    expect(headers['Range']).toBe('0-0');
  });
});

describe('queryCounts', () => {
  it('returns counts from three parallel queries', async () => {
    fetchMock
      .mockResolvedValueOnce(countResponse(509))  // active roles
      .mockResolvedValueOnce(countResponse(676))  // location links
      .mockResolvedValueOnce(countResponse(400)); // roles with coords
    const counts = await queryCounts('http://db', 'key');
    expect(counts).toEqual({ activeRoles: 509, locationLinks: 676, rolesWithCoords: 400 });
  });

  it('queries the correct PostgREST paths', async () => {
    fetchMock.mockResolvedValue(countResponse(1));
    await queryCounts('http://db', 'key');
    const urls = fetchMock.mock.calls.map(([url]: [string]) => url);
    expect(urls[0]).toContain('jobs?is_active=eq.true');
    expect(urls[1]).toContain('job_locations?');
    expect(urls[2]).toContain('job_locations!inner(locations!inner(coords))');
  });
});
