import { describe, expect, it } from "vitest";

import { accuracyKm, COARSE_ACCURACY_M, isCoarse } from "@/lib/geo/accuracy";
import { BUCKET_KM } from "@/lib/geo/metro-bucket";

describe("the coarse-position line", () => {
  // Tied to the sort's own ring size rather than to a number typed in twice: if
  // the bucket ever moves, the disclosure threshold moves with it.
  it("sits at half a metro ring", () => {
    expect(COARSE_ACCURACY_M).toBe((BUCKET_KM * 1000) / 2);
  });

  it("says nothing about a rooftop fix", () => {
    expect(isCoarse(30)).toBe(false);
    expect(isCoarse(2_000)).toBe(false);
  });

  // The case this exists for: an IP-derived fix, tens of kilometres wide,
  // straddling the bucket the sort orders by.
  it("flags a fix wide enough to straddle a ring", () => {
    expect(isCoarse(42_000)).toBe(true);
    expect(isCoarse(COARSE_ACCURACY_M)).toBe(true);
  });

  // No position is not an inaccurate position. Nothing to disclose.
  it("treats a missing or nonsense radius as nothing to say", () => {
    expect(isCoarse(null)).toBe(false);
    expect(isCoarse(Number.NaN)).toBe(false);
    expect(isCoarse(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("saying a radius out loud", () => {
  // A radius of 42,317m is not known to the metre, and printing it that way is
  // a second false precision inside the sentence disclosing the first one.
  it("rounds to something a person would say", () => {
    expect(accuracyKm(42_317)).toBe(40);
    expect(accuracyKm(87_000)).toBe(90);
  });

  it("keeps single kilometres useful, and never says zero", () => {
    expect(accuracyKm(3_400)).toBe(3);
    expect(accuracyKm(200)).toBe(1);
  });
});
