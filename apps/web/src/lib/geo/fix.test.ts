import { describe, expect, it } from "vitest";

import { coarsen, parseFix } from "@/lib/geo/fix";

describe("coarsen", () => {
  it("drops everything below about a kilometre", () => {
    expect(coarsen({ lat: 37.234567, lng: -121.987654 })).toEqual({
      lat: 37.23,
      lng: -121.99,
    });
  });

  // 0.01 degrees is roughly 1.1km, and the bucket is 50km. The rounding is
  // therefore 45 times smaller than the smallest thing it could change.
  it("cannot move a position more than a rounding step", () => {
    const exact = { lat: 51.5074, lng: -0.1278 };
    const coarse = coarsen(exact);

    expect(Math.abs(coarse.lat - exact.lat)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(coarse.lng - exact.lng)).toBeLessThanOrEqual(0.005);
  });
});

describe("parseFix", () => {
  it("accepts a pair of numbers in range", () => {
    expect(parseFix({ lat: -33.87, lng: 151.21 })).toEqual({ lat: -33.87, lng: 151.21 });
  });

  it.each([
    ["nothing", null],
    ["a string body", "37,-121"],
    ["a missing longitude", { lat: 37 }],
    ["a longitude as text", { lat: 37, lng: "-121" }],
    ["a latitude past the pole", { lat: 91, lng: 0 }],
    ["a longitude past the meridian", { lat: 0, lng: 181 }],
    ["NaN", { lat: Number.NaN, lng: 0 }],
  ])("rejects %s", (_name, body) => {
    expect(parseFix(body)).toBeNull();
  });

  // The one that matters: a half-read position is not a position. lat with no
  // lng must not survive as lng 0, which is a meridian running through Accra.
  it("never fills in a missing half", () => {
    expect(parseFix({ lat: 51.5 })).toBeNull();
    expect(parseFix({ lng: -0.12 })).toBeNull();
  });
});
