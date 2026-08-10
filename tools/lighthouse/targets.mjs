const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const restBase = () =>
  (process.env.SUPABASE_URL ?? "http://127.0.0.1:54721").replace(/\/+$/, "");

// The job page under test is whichever posting is newest, resolved at run time
// rather than pinned. A pinned id rots the day the ingestor deactivates that
// posting, and the gate would then be measuring a 404 and scoring it well.
// LIGHTHOUSE_JOB_ID overrides it when you want to re-check one specific page.
// Against a deployed origin the local Supabase is the wrong database to ask --
// it may hold a different set of postings than the one that origin is serving.
// The board itself is the authority on what it will render, so take the first
// posting it links to.
async function jobIdFromBoard(origin) {
  const response = await fetch(`${origin}/`, { redirect: "follow" });

  if (!response.ok) {
    throw new Error(`${origin} said ${response.status} asking for the board`);
  }

  const [, jobId] = /\/jobs\/([A-Za-z0-9]+)/.exec(await response.text()) ?? [];

  if (!jobId) {
    throw new Error(`No job links on ${origin}; nothing to audit`);
  }

  return jobId;
}

async function newestJobId(origin) {
  if (process.env.LIGHTHOUSE_JOB_ID) {
    return process.env.LIGHTHOUSE_JOB_ID;
  }

  if (process.env.LIGHTHOUSE_ORIGIN) {
    return jobIdFromBoard(origin);
  }

  const url =
    `${restBase()}/rest/v1/jobs?select=display_job_id&is_active=eq.true` +
    `&order=posting_date.desc.nullslast,position_id.desc&limit=1`;

  const response = await fetch(url, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY ?? ANON_KEY },
  });

  if (!response.ok) {
    throw new Error(`Supabase said ${response.status} asking for a job id`);
  }

  const [job] = await response.json();

  if (!job) {
    throw new Error("No active jobs in the database; nothing to audit");
  }

  return job.display_job_id;
}

export async function targets(origin) {
  const jobId = await newestJobId(origin);

  return [
    { label: "listing  /", url: `${origin}/` },
    { label: `detail   /jobs/${jobId}`, url: `${origin}/jobs/${jobId}` },
    // /about holds the same bar as the two pages that carry the product. It is
    // the page that claims the scores, so it is in the run that produces them.
    { label: "about    /about", url: `${origin}/about` },
  ];
}
