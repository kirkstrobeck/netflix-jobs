import { describe, expect, it } from "vitest";

import { isJobId } from "@/lib/jobs/types";

describe("isJobId", () => {
  it("accepts the common five-digit shape", () => {
    expect(isJobId("JR41912")).toBe(true);
  });

  it("accepts a longer letter run", () => {
    expect(isJobId("AJRT30201")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isJobId("")).toBe(false);
  });

  it("rejects letters with no digits", () => {
    expect(isJobId("hello")).toBe(false);
  });

  it("rejects digits with no letters", () => {
    expect(isJobId("790298014263")).toBe(false);
  });

  it("rejects punctuation", () => {
    expect(isJobId("FUCK-OFF")).toBe(false);
  });
});
