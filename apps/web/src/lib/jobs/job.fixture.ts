import type { Job } from "@/lib/jobs/types";

// A fully populated posting used to exercise the happy paths across the job
// detail components: two distinct locations (to hit the "Locations" plural
// label), a display_job_id, and a parseable posting_date.
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
  work_location_option: "Hybrid",
  work_type: "Full-time",
  description_html:
    "<h1>About the team</h1><p>We build the tools every engineer at Netflix relies on.</p>",
  description_text:
    "We build the tools every engineer at Netflix relies on every single day.",
  apply_url: "https://explore.jobs.netflix.net/careers/job/730201",
  canonical_url: "https://explore.jobs.netflix.net/careers/job/730201",
  posting_date: "2026-01-15",
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
  work_location_option: null,
  work_type: null,
  description_html: "<p>Minimal role with nothing else on file.</p>",
  description_text: "Minimal role with nothing else on file.",
  apply_url: "https://explore.jobs.netflix.net/careers/job/999999",
  canonical_url: "https://explore.jobs.netflix.net/careers/job/999999",
  posting_date: null,
};
