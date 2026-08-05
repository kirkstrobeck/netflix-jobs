// Mirrors the columns selected in get-job.ts. Nullability follows
// supabase/migrations/20260804040000_netflix_jobs.sql: only the text columns
// declared without NOT NULL are optional here.
export type Job = {
  position_id: number;
  display_job_id: string | null;
  title: string;
  department: string | null;
  business_unit: string | null;
  team: string | null;
  location: string;
  locations: string[];
  work_location_option: string | null;
  work_type: string | null;
  description_html: string;
  description_text: string;
  apply_url: string;
  canonical_url: string;
  posting_date: string | null;
};

// position_id is a bigint primary key. A value of any other shape is not a job id, and asking
// PostgREST about it earns a 400 rather than an empty result.
export function isJobId(value: string): boolean {
  return /^\d{1,19}$/.test(value);
}
