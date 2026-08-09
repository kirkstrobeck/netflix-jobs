import type { Board } from "@/lib/jobs/board";
import type { JobSummary } from "@/lib/jobs/job-summary";
import type { Site } from "@/lib/jobs/site";

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
    business_unit: "Streaming",
    sites: ["us-los-gatos"],
    work_type: "Onsite",
    posting_date: "2026-01-15",
    ...overrides,
  };
}

function place(slug: string, city: string, country: [string, string], region?: string): Site {
  return {
    slug,
    city,
    region: region ?? null,
    country_code: country[0],
    country: country[1],
    is_remote: false,
    display_name: [city, region, country[1]].filter(Boolean).join(", "),
  };
}

function remote(slug: string, country: [string, string]): Site {
  return {
    slug,
    city: null,
    region: null,
    country_code: country[0],
    country: country[1],
    is_remote: true,
    display_name: `Remote, ${country[1]}`,
  };
}

const US: [string, string] = ["US", "United States"];
const JP: [string, string] = ["JP", "Japan"];
const CA: [string, string] = ["CA", "Canada"];

// The seven sites the fixtures below draw on, in the shape the database
// returns. Three countries, one of them (the US) with several offices and a
// remote scope -- which is the arrangement every interesting case in the
// country facet needs: a country worth nesting, a country not worth nesting,
// and a remote scope that has to stay inside its country.
export const SITES: Site[] = [
  place("us-los-gatos", "Los Gatos", US, "California"),
  place("us-los-angeles", "Los Angeles", US, "California"),
  place("us-new-york", "New York", US),
  remote("us-remote", US),
  place("jp-tokyo", "Tokyo", JP),
  place("ca-vancouver", "Vancouver", CA, "British Columbia"),
  remote("ca-remote", CA),
];

// A board with a known shape, mirroring the real data's proportions: teams of
// different sizes, two work types, and one job posted at several sites.
//
//   team          Engineering 3, Marketing 2
//   workType      Onsite 3, Remote 2
//   businessUnit  Streaming 4, Animation 1
//   country       US 4, JP 1
//   site          us-los-gatos 2, us-remote 2, jp-tokyo 1, us-new-york 1
export const JOBS: JobSummary[] = [
  summary({ title: "Senior software engineer", team: "Engineering" }),
  summary({ title: "Staff software engineer", team: "Engineering" }),
  summary({
    title: "Engineering manager, playback",
    team: "Engineering",
    work_type: "Remote",
    sites: ["us-remote"],
  }),
  summary({
    title: "Marketing manager",
    team: "Marketing",
    sites: ["jp-tokyo"],
  }),
  // The one posting outside the dominant unit, so a business-unit filter has
  // something to narrow TO rather than only something to narrow away.
  summary({
    title: "Brand designer",
    team: "Marketing",
    business_unit: "Animation",
    work_type: "Remote",
    sites: ["us-new-york", "us-remote"],
  }),
];

export const BOARD: Board = { sites: SITES, jobs: JOBS };

/** A board around a given set of postings, sharing the fixture catalog. */
export function board(jobs: JobSummary[]): Board {
  return { sites: SITES, jobs };
}
