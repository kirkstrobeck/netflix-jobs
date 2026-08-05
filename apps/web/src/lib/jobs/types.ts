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

// The URL key is display_job_id, the code Netflix prints on the posting: ASCII
// letters followed by digits.
//
// Measured over all 481 rows, the letter run is 2-4 long and the digit run is
// always exactly 5. Those bounds are deliberately NOT encoded here. The shape is
// not the uniform "4 letters + 5 digits" that AJRT30201 suggests -- 480 rows are
// JR##### and exactly one is AJRT30201 -- so pinning the letter count to either
// observation would 404 the other group, and pinning the digit count would break
// on the first six-digit code Netflix issues. Letters-then-digits is the
// invariant worth asserting; the exact run lengths are a fact about today's
// crawl, not a rule.
//
// This no longer selects between two 404 pages -- there is only one now. Its
// remaining job is to spare the database a round trip for input that can never
// name a posting: FUCK-OFF (punctuation), hello (no digits), the empty segment,
// and 790298014263 (the old position_id -- digits with no letters). Rejecting
// here and returning no row are the same outcome for the visitor, so a false
// negative would silently 404 a real job; that is why the shape stays loose.
export function isJobId(value: string): boolean {
  return /^[A-Za-z]+[0-9]+$/.test(value);
}
