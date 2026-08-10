import { describe, expect, it } from "vitest";

import { describePosting } from "@/lib/format/posted-recency";

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
      expect(describePosting("2026-08-06", NOW)).toBe("today");
    });

    it("reads yesterday one day back", () => {
      expect(describePosting("2026-08-05", NOW)).toBe("yesterday");
    });

    it("counts days while the gap is under a week", () => {
      expect(describePosting("2026-08-03", NOW)).toBe("3 days ago");
    });

    it("switches to weeks once a whole week has passed", () => {
      expect(describePosting("2026-07-23", NOW)).toBe("2 weeks ago");
    });

    it("switches to months at 30 days", () => {
      expect(describePosting("2026-05-06", NOW)).toBe("3 months ago");
    });

    it("switches to years at 365 days", () => {
      expect(describePosting("2024-08-06", NOW)).toBe("2 years ago");
    });

    it("clamps a posting dated ahead of the reader to today", () => {
      expect(describePosting("2026-08-10", NOW)).toBe("today");
    });
  });

  // THE BOUNDARY THAT IS NOT HERE ANY MORE.
  //
  // There used to be a second half to this suite, pinning both sides of a
  // seven-day line: the day a posting stopped being "New". The badge that line
  // existed for is gone, and a threshold nothing reads is a number to be
  // maintained rather than a rule to be kept. What is left is the label, which
  // is the whole of what this module now says.
  it("returns a bare label, with no recency flag beside it", () => {
    expect(describePosting("2026-07-31", NOW)).toBe("6 days ago");
    expect(describePosting("2026-07-30", NOW)).toBe("last week");
  });
});
