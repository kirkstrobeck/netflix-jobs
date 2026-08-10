import type { Job } from "@/lib/jobs/types";

// A fully populated posting used to exercise the happy paths across the job
// detail components: two distinct locations (to hit the "Locations" plural
// label), a display_job_id, and a parseable posting_date.
//
// `sites` names two of the fixture catalog's US rows (see job-summary.fixture),
// so the location links resolve against a country that has more than one office
// -- which is the case where the link carries a site as well as a country.
export const SAMPLE_JOB: Job = {
  position_id: 730201,
  display_job_id: "JR73020",
  title: "Senior Software Engineer, Platform",
  department: "Engineering",
  business_unit: "Product Engineering",
  team: "Developer Platform",
  location: "Los Angeles,California,United States of America",
  locations: [
    "Los Angeles,California,United States of America",
    "Remote,United States of America",
  ],
  sites: ["us-los-angeles", "us-remote"],
  work_location_option: "Hybrid",
  work_type: "Full-time",
  description_html:
    "<h1>About the team</h1><p>We build the tools every engineer at Netflix relies on.</p>",
  description_text:
    "We build the tools every engineer at Netflix relies on every single day.",
  canonical_url: "https://explore.jobs.netflix.net/careers/job/730201",
  posting_date: "2026-01-15",
  source_created_at: "2026-01-02T00:00:00+00:00",
};

// posting_date is empty on 179 of the 481 rows, so the datePosted fallback needs
// a fixture of its own: everything present except the date the employer stated.
export const UNDATED_JOB: Job = {
  ...SAMPLE_JOB,
  position_id: 730202,
  display_job_id: "JR73021",
  posting_date: null,
};

// Every nullable column set to null and no locations, so components fall
// back to their default copy: "Netflix" for the team/department eyebrow,
// "Location to be confirmed" / "Not listed" for missing facts, and the bare
// position_id for the Job ID row.
export const MINIMAL_JOB: Job = {
  position_id: 999999,
  display_job_id: null,
  title: "Support Specialist",
  department: null,
  business_unit: null,
  team: null,
  location: "",
  locations: [],
  // No rows in job_locations either, so there is nothing to link and the raw
  // strings are all the page has -- which for this fixture is nothing at all.
  sites: [],
  work_location_option: null,
  work_type: null,
  description_html: "<p>Minimal role with nothing else on file.</p>",
  description_text: "Minimal role with nothing else on file.",
  canonical_url: "https://explore.jobs.netflix.net/careers/job/999999",
  posting_date: null,
  source_created_at: null,
};
