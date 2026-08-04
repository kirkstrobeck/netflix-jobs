// Writes go through the local Supabase PostgREST endpoint with the service-role
// key, which bypasses RLS. Using the HTTP API instead of a pg client keeps this
// package dependency-free — it runs under plain `node bin/ingest.ts`.

const DEFAULT_URL = 'http://127.0.0.1:54721';
// Supabase's local stack ships a fixed demo service-role JWT; override for anything real.
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export type JobRow = {
  position_id: string;
  display_job_id: string | null;
  ats_job_id: string | null;
  job_req_id: string | null;
  title: string;
  posting_name: string | null;
  normalized_title: string;
  department: string | null;
  business_unit: string | null;
  team: string | null;
  location: string;
  locations: string[];
  work_location_option: string | null;
  location_flexibility: string | null;
  work_type: string | null;
  description_html: string;
  description_text: string;
  apply_url: string;
  canonical_url: string;
  locale: string | null;
  is_hot: boolean;
  is_private: boolean;
  posting_date: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  raw: unknown;
};

export function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? DEFAULT_URL).replace(/\/+$/, '');
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? DEFAULT_SERVICE_KEY;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(
  path: string,
  init: RequestInit,
  extraHeaders: Record<string, string> = {},
): Promise<unknown> {
  const res = await fetch(`${supabaseUrl()}${path}`, {
    ...init,
    headers: headers(extraHeaders),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
}

export async function startRun(): Promise<string> {
  const rows = (await request(
    '/rest/v1/ingest_runs',
    { method: 'POST', body: JSON.stringify({ status: 'running' }) },
    { Prefer: 'return=representation' },
  )) as Array<{ id: string }> | null;
  const id = rows?.[0]?.id;
  if (!id) throw new Error('could not create ingest_runs row');
  return id;
}

export async function finishRun(
  runId: string,
  status: string,
  counts: Record<string, number>,
  notes: string,
): Promise<void> {
  await request(`/rest/v1/ingest_runs?id=eq.${runId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      finished_at: new Date().toISOString(),
      status,
      listed_count: counts.listed ?? 0,
      detail_ok_count: counts.detailOk ?? 0,
      detail_failed_count: counts.detailFailed ?? 0,
      upserted_count: counts.upserted ?? 0,
      deactivated_count: counts.deactivated ?? 0,
      notes,
    }),
  });
}

export async function ingestJobs(rows: JobRow[], runId: string): Promise<number> {
  if (rows.length === 0) return 0;
  const affected = await rpc('ingest_jobs', { payload: rows, run: runId });
  return Number(affected ?? 0);
}

export async function deactivateMissing(runId: string): Promise<number> {
  const affected = await rpc('deactivate_missing_jobs', { run: runId });
  return Number(affected ?? 0);
}

export async function countJobs(): Promise<number> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/jobs?select=position_id`, {
    headers: headers({ Prefer: 'count=exact', Range: '0-0' }),
  });
  const range = res.headers.get('content-range') ?? '';
  return Number(range.split('/')[1] ?? 0);
}
