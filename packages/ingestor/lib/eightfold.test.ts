import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BOARD,
  LIST_PAGE_SIZE,
  SORT_ORDERS,
  customField,
  detailUrl,
  epochToIso,
  fetchDetail,
  fetchListPage,
  jobUrl,
  listUrl,
  positionLocations,
  positionTitle,
  postingDate,
  type Position,
} from './eightfold.ts';
import { fetchJson } from './http.ts';

vi.mock('./http.ts', () => ({ fetchJson: vi.fn() }));

const fetchJsonMock = vi.mocked(fetchJson);

function withFields(fields: Record<string, string[]>): Position {
  return { custom_JD: { data_fields: fields } };
}

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe('constants', () => {
  it('targets the Netflix tenant with a 10-per-page list', () => {
    expect(BOARD).toEqual({ host: 'explore.jobs.netflix.net', domain: 'netflix.com' });
    expect(LIST_PAGE_SIZE).toBe(10);
    expect(SORT_ORDERS).toEqual(['relevance', 'timestamp', 'distance']);
  });
});

describe('url builders', () => {
  it('defaults listUrl to relevance ordering', () => {
    expect(listUrl(0)).toBe(
      'https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=0&num=10&sort_by=relevance',
    );
  });

  it('threads start and sort order into listUrl', () => {
    expect(listUrl(30, 'timestamp')).toBe(
      'https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=30&num=10&sort_by=timestamp',
    );
  });

  it('builds detail and job urls for string and numeric ids', () => {
    expect(detailUrl(790123)).toBe(
      'https://explore.jobs.netflix.net/api/apply/v2/jobs/790123?domain=netflix.com',
    );
    expect(detailUrl('790123')).toBe(
      'https://explore.jobs.netflix.net/api/apply/v2/jobs/790123?domain=netflix.com',
    );
    expect(jobUrl(790123)).toBe('https://explore.jobs.netflix.net/careers/job/790123');
  });
});

describe('positionLocations', () => {
  it('trims, drops blanks and dedupes the locations array', () => {
    const position = { locations: ['  Los Gatos, CA ', 'Remote', 'Los Gatos, CA', '  '] };
    expect(positionLocations(position)).toEqual(['Los Gatos, CA', 'Remote']);
  });

  it('falls back to the single location field', () => {
    expect(positionLocations({ location: ' New York, NY ' })).toEqual(['New York, NY']);
    expect(positionLocations({ locations: [], location: 'Remote' })).toEqual(['Remote']);
  });

  it('drops null and undefined entries from the locations array', () => {
    const position = { locations: [null, 'Remote', undefined] as unknown as string[] };
    expect(positionLocations(position)).toEqual(['Remote']);
  });

  it('returns an empty array when nothing is set', () => {
    expect(positionLocations({})).toEqual([]);
    expect(positionLocations({ location: '   ' })).toEqual([]);
    expect(positionLocations({ locations: ['  '] })).toEqual([]);
  });
});

describe('positionTitle', () => {
  it('prefers name, falls back to posting_name, then empty', () => {
    expect(positionTitle({ name: '  Engineer ', posting_name: 'Other' })).toBe('Engineer');
    expect(positionTitle({ posting_name: ' Fallback ' })).toBe('Fallback');
    expect(positionTitle({})).toBe('');
  });
});

describe('customField', () => {
  it('returns the first trimmed entry of a data field', () => {
    expect(customField(withFields({ team: ['  Ads Engineering ', 'Second'] }), 'team')).toBe(
      'Ads Engineering',
    );
  });

  it('returns null for missing, non-array, empty and blank values', () => {
    expect(customField({}, 'team')).toBeNull();
    expect(customField(withFields({}), 'team')).toBeNull();
    expect(customField(withFields({ team: [] }), 'team')).toBeNull();
    expect(customField(withFields({ team: ['   '] }), 'team')).toBeNull();
    expect(customField({ custom_JD: {} }, 'team')).toBeNull();
    expect(customField({ custom_JD: { data_fields: { team: 'x' as never } } }, 'team')).toBeNull();
  });
});

describe('postingDate', () => {
  it('rewrites MM-DD-YYYY into an ISO date', () => {
    expect(postingDate(withFields({ posting_date: ['03-27-2025'] }))).toBe('2025-03-27');
  });

  it('returns null for malformed or absent dates', () => {
    expect(postingDate(withFields({ posting_date: ['2025-03-27'] }))).toBeNull();
    expect(postingDate(withFields({ posting_date: ['3-7-2025'] }))).toBeNull();
    expect(postingDate(withFields({ posting_date: ['not a date'] }))).toBeNull();
    expect(postingDate(withFields({ posting_date: [''] }))).toBeNull();
    expect(postingDate({})).toBeNull();
  });
});

describe('epochToIso', () => {
  it('converts epoch seconds to an ISO timestamp', () => {
    expect(epochToIso(1_700_000_000)).toBe('2023-11-14T22:13:20.000Z');
  });

  it('returns null for undefined, zero and non-finite input', () => {
    expect(epochToIso(undefined)).toBeNull();
    expect(epochToIso(0)).toBeNull();
    expect(epochToIso(Number.NaN)).toBeNull();
    expect(epochToIso(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('fetchListPage', () => {
  it('requests the list url and returns positions with a total', async () => {
    fetchJsonMock.mockResolvedValue({ positions: [{ id: 1 }, { id: 2 }], count: 481 });

    await expect(fetchListPage(20, 'distance')).resolves.toEqual({
      positions: [{ id: 1 }, { id: 2 }],
      total: 481,
    });
    expect(fetchJsonMock).toHaveBeenCalledWith(listUrl(20, 'distance'), 'list distance @20');
  });

  it('drops positions with no id', async () => {
    fetchJsonMock.mockResolvedValue({ positions: [{ id: 1 }, { name: 'no id' }], count: 2 });

    const page = await fetchListPage(0);
    expect(page.positions).toEqual([{ id: 1 }]);
    expect(fetchJsonMock).toHaveBeenCalledWith(listUrl(0, 'relevance'), 'list relevance @0');
  });

  it('handles a response with no positions or count', async () => {
    fetchJsonMock.mockResolvedValue({});
    await expect(fetchListPage(0)).resolves.toEqual({ positions: [], total: 0 });
  });
});

describe('fetchDetail', () => {
  it('requests the detail url with a longer timeout', async () => {
    fetchJsonMock.mockResolvedValue({ id: 7, name: 'Engineer' });

    await expect(fetchDetail(7)).resolves.toEqual({ id: 7, name: 'Engineer' });
    expect(fetchJsonMock).toHaveBeenCalledWith(detailUrl(7), 'detail 7', { timeoutMs: 25_000 });
  });
});
