import { describe, expect, it } from "vitest";

import { formatPostedDate } from "@/lib/format/posted-date";

describe("formatPostedDate", () => {
  it("returns null for null input", () => {
    expect(formatPostedDate(null)).toBeNull();
  });

  it("returns null for an invalid format", () => {
    expect(formatPostedDate("08/06/2026")).toBeNull();
  });

  it("returns null for an invalid month", () => {
    expect(formatPostedDate("2026-13-01")).toBeNull();
  });

  it("formats a valid YYYY-MM-DD date", () => {
    expect(formatPostedDate("2026-08-06")).toBe("August 6, 2026");
  });
});
