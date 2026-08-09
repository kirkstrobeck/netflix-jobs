import { describe, expect, it } from "vitest";

import { summary } from "@/lib/jobs/job-summary.fixture";
import { jobBucket, orderResults, sortByNearest, UNPLACED } from "@/lib/search/sort-jobs";

// Rings as a visitor in Los Gatos would see them: the two California offices in
// ring 0, New York eight rings out. The remote scopes are ABSENT, which is the
// whole point -- sites_by_distance never returns a row without coordinates.
const FROM_LOS_GATOS = {
  "us-los-gatos": 0,
  "us-los-angeles": 0,
  "us-new-york": 83,
};

const titles = (jobs: { title: string }[]) => jobs.map((job) => job.title);

describe("jobBucket", () => {
  it("takes the nearest of a posting's sites", () => {
    const job = summary({ sites: ["us-new-york", "us-los-gatos"] });

    expect(jobBucket(job, FROM_LOS_GATOS)).toBe(0);
  });

  // The failure this codebase is built to avoid: no coordinates read as zero.
  it("does not read a site with no coordinates as distance zero", () => {
    expect(jobBucket(summary({ sites: ["us-remote"] }), FROM_LOS_GATOS)).toBe(UNPLACED);
  });

  it("still places a posting that is remote AND in an office", () => {
    const job = summary({ sites: ["us-remote", "us-los-angeles"] });

    expect(jobBucket(job, FROM_LOS_GATOS)).toBe(0);
  });

  it("has no ring at all when nothing is placed", () => {
    expect(jobBucket(summary({ sites: [] }), FROM_LOS_GATOS)).toBe(UNPLACED);
  });
});

describe("sortByNearest", () => {
  it("orders by ring", () => {
    const jobs = [
      summary({ title: "New York", sites: ["us-new-york"] }),
      summary({ title: "Los Gatos", sites: ["us-los-gatos"] }),
    ];

    expect(titles(sortByNearest(jobs, FROM_LOS_GATOS))).toEqual([
      "Los Gatos",
      "New York",
    ]);
  });

  // "Both here, newer first". The input arrives newest-first from the board, and
  // a stable sort on ring alone is what preserves that inside a ring -- so two
  // offices 15km apart never trade places on the strength of those 15km.
  it("keeps the newest-first order inside one ring", () => {
    const jobs = [
      summary({ title: "Newer, Los Angeles", sites: ["us-los-angeles"] }),
      summary({ title: "Older, Los Gatos", sites: ["us-los-gatos"] }),
    ];

    expect(titles(sortByNearest(jobs, FROM_LOS_GATOS))).toEqual([
      "Newer, Los Angeles",
      "Older, Los Gatos",
    ]);
  });

  it("puts roles with no coordinates last, still newest first among themselves", () => {
    const jobs = [
      summary({ title: "Newer remote", sites: ["us-remote"] }),
      summary({ title: "Older remote", sites: ["ca-remote"] }),
      summary({ title: "New York", sites: ["us-new-york"] }),
    ];

    expect(titles(sortByNearest(jobs, FROM_LOS_GATOS))).toEqual([
      "New York",
      "Newer remote",
      "Older remote",
    ]);
  });

  // UNPLACED is finite for this reason. Infinity - Infinity is NaN, and a
  // comparator that returns NaN lets the engine arrange the list however it
  // likes -- which for a page of remote roles is every one of them.
  it("does not scramble a list that is entirely unplaced", () => {
    const jobs = [
      summary({ title: "First", sites: ["us-remote"] }),
      summary({ title: "Second", sites: ["ca-remote"] }),
      summary({ title: "Third", sites: [] }),
    ];

    expect(titles(sortByNearest(jobs, FROM_LOS_GATOS))).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("leaves the input array alone", () => {
    const jobs = [
      summary({ title: "New York", sites: ["us-new-york"] }),
      summary({ title: "Los Gatos", sites: ["us-los-gatos"] }),
    ];

    sortByNearest(jobs, FROM_LOS_GATOS);

    expect(titles(jobs)).toEqual(["New York", "Los Gatos"]);
  });
});

describe("orderResults", () => {
  const jobs = [
    summary({ title: "New York", sites: ["us-new-york"] }),
    summary({ title: "Los Gatos", sites: ["us-los-gatos"] }),
  ];

  it("leaves newest alone even when rings are in hand", () => {
    expect(orderResults(jobs, "newest", FROM_LOS_GATOS)).toBe(jobs);
  });

  // The server's path, and the denied/timed-out browser's path, are the same
  // line of code: asked for nearest, given no rings, gets newest.
  it("falls back to newest when there are no rings", () => {
    expect(orderResults(jobs, "nearest", null)).toBe(jobs);
  });

  it("sorts when it has both", () => {
    expect(titles(orderResults(jobs, "nearest", FROM_LOS_GATOS))).toEqual([
      "Los Gatos",
      "New York",
    ]);
  });
});
