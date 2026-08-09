import { describe, expect, it } from "vitest";

import { BUCKET_KM, metroBucket } from "@/lib/geo/metro-bucket";

describe("metroBucket", () => {
  it("puts everything inside one bucket width in ring 0", () => {
    expect(metroBucket(0)).toBe(0);
    expect(metroBucket(BUCKET_KM - 0.001)).toBe(0);
  });

  it("starts the next ring exactly at the bucket width", () => {
    expect(metroBucket(BUCKET_KM)).toBe(1);
    expect(metroBucket(BUCKET_KM * 2)).toBe(2);
  });

  // The pair the number was chosen for. Burbank and Los Angeles are 15.5km
  // apart and are one metro, so a visitor anywhere in the basin has to see them
  // in the same ring -- which is what stops the two shuffling on distance.
  it("keeps Burbank and Los Angeles in one ring from downtown LA", () => {
    expect(metroBucket(0)).toBe(metroBucket(15.5));
  });

  // The nearest pair that is NOT one metro: Hsinchu and Taipei, an hour apart.
  it("separates two cities an hour apart", () => {
    expect(metroBucket(0)).not.toBe(metroBucket(65));
  });

  // A NaN sort key compares false against everything, which does not order a
  // list, it scrambles one.
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "refuses %p rather than turning it into a ring",
    (value) => {
      expect(metroBucket(value)).toBeNull();
    },
  );
});
