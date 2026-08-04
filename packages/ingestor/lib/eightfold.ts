// Shape + request layer for an Eightfold ("PCS") careers board.
// Netflix's tenant is explore.jobs.netflix.net with domain netflix.com.

import { fetchJson } from './http.ts';

export const BOARD = { host: 'explore.jobs.netflix.net', domain: 'netflix.com' };

// The list endpoint ignores `num` above 10 and always returns an empty
// job_description, so the crawl is 1 list page per 10 jobs + 1 detail per job.
export const LIST_PAGE_SIZE = 10;

export type Position = {
  id?: number | string;
  name?: string;
  posting_name?: string;
  location?: string;
  locations?: string[];
  hot?: number;
  department?: string;
  business_unit?: string;
  t_create?: number;
  t_update?: number;
  ats_job_id?: string;
  display_job_id?: string;
  job_description?: string;
  locale?: string;
  location_flexibility?: string | null;
  work_location_option?: string | null;
  canonicalPositionUrl?: string;
  isPrivate?: boolean;
  custom_JD?: { data_fields?: Record<string, string[]> };
};

type ListResponse = { positions?: Position[]; count?: number };

// A single relevance-ordered sweep misses a handful of postings: the ordering
// shifts between requests, so some rows land on a page the crawl already passed.
// Re-sweeping under a different sort surfaces the stragglers.
export const SORT_ORDERS = ['relevance', 'timestamp', 'distance'];

export function listUrl(start: number, sortBy = 'relevance'): string {
  const params = new URLSearchParams({
    domain: BOARD.domain,
    start: String(start),
    num: String(LIST_PAGE_SIZE),
    sort_by: sortBy,
  });
  return `https://${BOARD.host}/api/apply/v2/jobs?${params}`;
}

export function detailUrl(id: string | number): string {
  return `https://${BOARD.host}/api/apply/v2/jobs/${id}?domain=${BOARD.domain}`;
}

export function jobUrl(id: string | number): string {
  return `https://${BOARD.host}/careers/job/${id}`;
}

export async function fetchListPage(
  start: number,
  sortBy = 'relevance',
): Promise<{ positions: Position[]; total: number }> {
  const data = (await fetchJson(
    listUrl(start, sortBy),
    `list ${sortBy} @${start}`,
  )) as ListResponse;
  const positions = (data.positions ?? []).filter((p) => p.id !== undefined);
  return { positions, total: Number(data.count ?? 0) };
}

export async function fetchDetail(id: string | number): Promise<Position> {
  return (await fetchJson(detailUrl(id), `detail ${id}`, {
    timeoutMs: 25_000,
  })) as Position;
}

export function positionLocations(position: Position): string[] {
  const listed = (position.locations ?? [])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
  if (listed.length > 0) return [...new Set(listed)];
  const single = String(position.location ?? '').trim();
  return single ? [single] : [];
}

export function positionTitle(position: Position): string {
  return String(position.name ?? position.posting_name ?? '').trim();
}

function dataField(position: Position, key: string): string | null {
  const value = position.custom_JD?.data_fields?.[key];
  const first = Array.isArray(value) ? String(value[0] ?? '').trim() : '';
  return first || null;
}

export function customField(position: Position, key: string): string | null {
  return dataField(position, key);
}

// custom_JD posting_date arrives as MM-DD-YYYY.
export function postingDate(position: Position): string | null {
  const raw = dataField(position, 'posting_date');
  const match = raw ? /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw) : null;
  if (!match) return null;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

export function epochToIso(seconds: number | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}
