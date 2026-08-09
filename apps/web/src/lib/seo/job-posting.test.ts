import { describe, expect, it } from "vitest";

import { MINIMAL_JOB, SAMPLE_JOB, UNDATED_JOB } from "@/lib/jobs/job.fixture";
import { buildJobPosting } from "@/lib/seo/job-posting";
import { checkJobPosting } from "@/lib/seo/rules/job-posting-rules";

// The builder's output is judged by the rules transcribed from Google's spec,
// never by comparison with a stored copy of itself. A fixture diff would go on
// passing after both sides drifted together.
const violations = (job: Parameters<typeof buildJobPosting>[0]) =>
  checkJobPosting(buildJobPosting(job));

const remote = { ...SAMPLE_JOB, work_type: "Remote", locations: ["USA - Remote"] };

describe("buildJobPosting", () => {
  it("satisfies every rule Google states for a plain onsite posting", () => {
    expect(violations(SAMPLE_JOB)).toEqual([]);
  });

  it("carries the required properties", () => {
    const posting = buildJobPosting(SAMPLE_JOB)!;

    expect(posting.title).toBe(SAMPLE_JOB.title);
    expect(posting.datePosted).toBe(SAMPLE_JOB.posting_date);
    expect(posting.description).toContain("<p>");
    expect(posting.url).toBe(SAMPLE_JOB.canonical_url);
    expect(posting.identifier).toEqual({
      "@type": "PropertyValue",
      name: "Netflix",
      value: SAMPLE_JOB.display_job_id,
    });
  });

  it("falls back to the position id when the board printed no job code", () => {
    const posting = buildJobPosting({ ...SAMPLE_JOB, display_job_id: null })!;

    expect(posting.identifier).toMatchObject({ value: String(SAMPLE_JOB.position_id) });
  });

  it("dates an undated posting from when it appeared on the board", () => {
    const posting = buildJobPosting(UNDATED_JOB)!;

    expect(posting.datePosted).toBe("2026-01-02");
    expect(violations(UNDATED_JOB)).toEqual([]);
  });

  it("omits employmentType, validThrough and baseSalary, which the crawl has no data for", () => {
    const posting = buildJobPosting(SAMPLE_JOB)!;

    expect(posting).not.toHaveProperty("employmentType");
    expect(posting).not.toHaveProperty("validThrough");
    expect(posting).not.toHaveProperty("baseSalary");
  });

  it("says directApply is false, because the application happens on Netflix's site", () => {
    expect(buildJobPosting(SAMPLE_JOB)!.directApply).toBe(false);
  });

  it("marks a fully remote posting TELECOMMUTE with an applicant area and no jobLocation", () => {
    const posting = buildJobPosting(remote)!;

    expect(posting.jobLocationType).toBe("TELECOMMUTE");
    expect(posting.applicantLocationRequirements).toEqual([
      { "@type": "Country", name: "USA" },
    ]);
    expect(posting).not.toHaveProperty("jobLocation");
    expect(violations(remote)).toEqual([]);
  });

  // Google's own second work-from-home scenario: a worksite AND a remote option.
  it("keeps both the worksites and the remote area when the posting lists both", () => {
    const mixed = {
      ...SAMPLE_JOB,
      work_type: "Remote",
      locations: ["USA - Remote", "Los Gatos,California,United States of America"],
    };
    const posting = buildJobPosting(mixed)!;

    expect(posting.jobLocationType).toBe("TELECOMMUTE");
    expect(posting.jobLocation).toHaveLength(1);
    expect(posting.applicantLocationRequirements).toHaveLength(1);
    expect(violations(mixed)).toEqual([]);
  });

  it("does not claim TELECOMMUTE for an onsite posting", () => {
    expect(buildJobPosting(SAMPLE_JOB)).not.toHaveProperty("jobLocationType");
  });

  it("collapses locations that describe the same place", () => {
    const twice = {
      ...SAMPLE_JOB,
      locations: [
        "Los Gatos,California,United States of America",
        "Los Gatos,California,United States of America",
      ],
    };

    expect(buildJobPosting(twice)!.jobLocation).toHaveLength(1);
  });

  it("falls back to the scalar location column when the array is empty", () => {
    const scalar = { ...SAMPLE_JOB, locations: [] };

    expect(buildJobPosting(scalar)!.jobLocation).toHaveLength(1);
  });

  it("drops a location whose country cannot be identified", () => {
    const partial = {
      ...SAMPLE_JOB,
      locations: ["Atlantis,Mu", "Los Gatos,California,United States of America"],
    };

    expect(buildJobPosting(partial)!.jobLocation).toHaveLength(1);
  });

  it("returns null rather than an invalid posting when nothing locates it", () => {
    expect(buildJobPosting(MINIMAL_JOB)).toBeNull();
    expect(buildJobPosting({ ...SAMPLE_JOB, locations: ["Atlantis,Mu"], location: "" })).toBeNull();
  });

  it("returns null when a required property is empty", () => {
    expect(buildJobPosting({ ...SAMPLE_JOB, title: "" })).toBeNull();
    expect(buildJobPosting({ ...SAMPLE_JOB, description_html: "" })).toBeNull();
    expect(
      buildJobPosting({ ...SAMPLE_JOB, posting_date: null, source_created_at: null }),
    ).toBeNull();
  });
});
