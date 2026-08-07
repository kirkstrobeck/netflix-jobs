import { describe, expect, it } from "vitest";

import { NEW_POSTING_DAYS, describePosting } from "@/lib/format/posted-recency";

// Built from local components rather than a UTC string so the reader's calendar
// day is 2026-08-06 whatever timezone the suite runs in.
const NOW = new Date(2026, 7, 6, 12, 0, 0).getTime();

describe("describePosting", () => {
  it("returns null for a date it cannot read", () => {
    expect(describePosting("08/06/2026", NOW)).toBeNull();
  });

  it("returns null for a month above 12 rather than rolling into next year", () => {
    expect(describePosting("2026-13-01", NOW)).toBeNull();
  });

  it("returns null for a month below 1", () => {
    expect(describePosting("2026-00-01", NOW)).toBeNull();
  });

  describe("label", () => {
    it("reads today for a posting dated the reader's own day", () => {
      expect(describePosting("2026-08-06", NOW)?.label).toBe("today");
    });

    it("reads yesterday one day back", () => {
      expect(describePosting("2026-08-05", NOW)?.label).toBe("yesterday");
    });

    it("counts days while the gap is under a week", () => {
      expect(describePosting("2026-08-03", NOW)?.label).toBe("3 days ago");
    });

    it("switches to weeks once a whole week has passed", () => {
      expect(describePosting("2026-07-23", NOW)?.label).toBe("2 weeks ago");
    });

    it("switches to months at 30 days", () => {
      expect(describePosting("2026-05-06", NOW)?.label).toBe("3 months ago");
    });

    it("switches to years at 365 days", () => {
      expect(describePosting("2024-08-06", NOW)?.label).toBe("2 years ago");
    });

    it("clamps a posting dated ahead of the reader to today", () => {
      expect(describePosting("2026-08-10", NOW)?.label).toBe("today");
    });
  });

  // NEW_POSTING_DAYS is 7, so the last New day is 6 days back and the first
  // ordinary one is 7. Both sides are pinned because the badge turns on here.
  describe(`the ${NEW_POSTING_DAYS}-day boundary`, () => {
    it("is new on the day it was posted", () => {
      expect(describePosting("2026-08-06", NOW)?.isNew).toBe(true);
    });

    it("is still new one day short of the boundary", () => {
      expect(describePosting("2026-07-31", NOW)).toEqual({
        label: "6 days ago",
        isNew: true,
      });
    });

    it("is no longer new exactly on the boundary", () => {
      expect(describePosting("2026-07-30", NOW)).toEqual({
        label: "last week",
        isNew: false,
      });
    });

    it("is no longer new past the boundary", () => {
      expect(describePosting("2026-07-29", NOW)?.isNew).toBe(false);
    });

    it("treats a future posting as new", () => {
      expect(describePosting("2026-08-10", NOW)?.isNew).toBe(true);
    });
  });
});
