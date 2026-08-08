import type { JobSummary } from "@/lib/jobs/job-summary";

let nextId = 1;

// Terse builder so a listing test can describe a board in a few lines and only
// state the fields it is actually asserting on.
export function summary(overrides: Partial<JobSummary> = {}): JobSummary {
  nextId += 1;

  return {
    position_id: nextId,
    display_job_id: `JR${nextId}`,
    title: "Software engineer",
    team: "Engineering",
    location: "Los Gatos,California,United States of America",
    locations: ["Los Gatos,California,United States of America"],
    work_type: "Onsite",
    posting_date: "2026-01-15",
    ...overrides,
  };
}

// A board with a known shape, mirroring the real data's proportions: teams of
// different sizes, two work types, and one job posted in several locations.
//
//   team      Engineering 3, Marketing 2
//   workType  Onsite 3, Remote 2
//   location  Los Gatos 2, USA - Remote 2, Tokyo 1, New York 1
export const BOARD: JobSummary[] = [
  summary({ title: "Senior software engineer", team: "Engineering" }),
  summary({ title: "Staff software engineer", team: "Engineering" }),
  summary({
    title: "Engineering manager, playback",
    team: "Engineering",
    work_type: "Remote",
    locations: ["USA - Remote"],
  }),
  summary({
    title: "Marketing manager",
    team: "Marketing",
    locations: ["Tokyo,Japan"],
  }),
  summary({
    title: "Brand designer",
    team: "Marketing",
    work_type: "Remote",
    locations: ["USA - Remote", "New York,New York,United States of America"],
  }),
];
