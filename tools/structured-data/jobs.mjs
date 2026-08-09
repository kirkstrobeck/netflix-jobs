// Every active posting, straight from the local Supabase stack -- the same rows
// the job pages render from, read through the same anon key and the same RLS
// policy.
//
// All of them, not a sample. The builders are pure functions over a row, so 481
// of them cost one query and a few milliseconds each; there is no honest reason
// to check one job and call the board covered. If this ever does get slow, the
// fix is a deterministic slice ordered by position_id, stated in the output --
// not a random one.
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Mirrors COLUMNS in apps/web/src/lib/jobs/get-job.ts. A column added there and
// forgotten here would validate a row the page does not render.
const COLUMNS = [
  "position_id",
  "display_job_id",
  "title",
  "department",
  "business_unit",
  "team",
  "location",
  "locations",
  "work_location_option",
  "work_type",
  "description_html",
  "description_text",
  "apply_url",
  "canonical_url",
  "posting_date",
  "source_created_at",
].join(",");

function restBase() {
  return (process.env.SUPABASE_URL ?? "http://127.0.0.1:54721").replace(/\/+$/, "");
}

export async function activeJobs() {
  const key = process.env.SUPABASE_ANON_KEY ?? ANON_KEY;
  const url =
    `${restBase()}/rest/v1/jobs?select=${COLUMNS}` +
    `&is_active=eq.true&order=position_id.asc`;

  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    throw new Error(
      `Supabase said ${response.status} reading jobs: ${await response.text()}`,
    );
  }

  const rows = await response.json();

  if (rows.length === 0) {
    throw new Error("No active jobs in the database; nothing to validate");
  }

  return rows;
}
