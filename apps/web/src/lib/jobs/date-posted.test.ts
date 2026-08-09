import { describe, expect, it } from "vitest";

import { postedOn } from "@/lib/jobs/date-posted";
import { MINIMAL_JOB, SAMPLE_JOB, UNDATED_JOB } from "@/lib/jobs/job.fixture";

describe("postedOn", () => {
  it("prefers the date the employer stated", () => {
    expect(postedOn(SAMPLE_JOB)).toEqual({ iso: "2026-01-15", verb: "Posted" });
  });

  // 179 of 481 rows have no posting_date. They all still have a creation
  // timestamp from the board, and it is labelled for what it is.
  it("falls back to when the posting appeared on the board, and says so", () => {
    expect(postedOn(UNDATED_JOB)).toEqual({ iso: "2026-01-02", verb: "Listed" });
  });

  it("has nothing to say when the row carries neither", () => {
    expect(postedOn(MINIMAL_JOB)).toBeNull();
  });
});
