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

// The URL key is display_job_id, the code Netflix prints on the posting. Across
// all 481 rows it is ASCII alphanumeric and uppercase, but the shape is NOT the
// uniform "4 letters + 5 digits" that AJRT30201 suggests: 480 rows are JR#####
// (two letters) and exactly one is AJRT30201. Anchoring on either specific shape
// would 404 the other, so this guard only rejects what can never be a code --
// punctuation, path junk, and unbounded input -- and lets the database decide
// whether a well-formed code actually exists.
export function isJobId(value: string): boolean {
  return /^[A-Za-z0-9]{2,32}$/.test(value);
}
