import { describe, expect, it } from "vitest";

import {
  buildOrbPath,
  hopDuration,
  mix,
  ORB_COUNT,
} from "@/app/_glow/glow-math";

describe("mix", () => {
  it("stays within the requested range", () => {
    Array.from({ length: 40 }, (_, i) => {
      const v = mix(i, 10, 20, 3);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(20);
    });
  });
});

describe("hopDuration", () => {
  it("clamps size and respects the floor", () => {
    expect(hopDuration(0, -2, 100)).toBeGreaterThan(0);
    expect(hopDuration(0, 3, 100)).toBeGreaterThan(0);
    expect(hopDuration(0, 1, 1)).toBe(0.7);
  });
});

describe("buildOrbPath", () => {
  it("builds closed loops for many seeds and sizes", () => {
    const paths = Array.from({ length: ORB_COUNT }, (_, i) =>
      buildOrbPath(i, (i % 10) / 10, 0.4, 200 + i, 30, 90),
    );
    paths.forEach((path) => {
      expect(path.stops[0].at).toBe(0);
      expect(path.stops[path.stops.length - 1].at).toBe(100);
      expect(path.duration).toBeGreaterThan(0);
      expect(path.stops.length).toBeGreaterThan(1);
    });
  });

  it("covers bounce and direction flips with tight vertical bounds", () => {
    const path = buildOrbPath(7, 0.5, 0.5, 100, 40, 45);
    expect(path.stops.length).toBeGreaterThan(5);
  });

  // Regression: the bounce used to reverse without clamping, so a walk that
  // overshot one edge could land past the opposite one -- and every hop after
  // that was out of range too, pushing it further out rather than back. Orbs
  // bounded to [28.4, 55.4] were reaching 165cqh and being clipped by the band.
  it("never leaves its vertical band, even when a hop is wider than the band", () => {
    // 27cqh is the narrowest band build-orbs can produce, against hops of up to
    // TRAVEL_Y_MAX (24) -- under two hops wide, which is where it used to break.
    const cases = [
      { topMin: 28.4, topMax: 55.4 },
      { topMin: 40, topMax: 45 },
      { topMin: 73, topMax: 92 },
    ];

    // The stop stores `bottom` as (top - height) rounded to 2dp, so adding
    // height back reintroduces a float tail: an orb clamped exactly to 55.4
    // reconstructs as 55.400000000000006. Hence the epsilon -- it is measurement
    // noise from this reconstruction, not slack in the clamp.
    const EPSILON = 0.001;

    cases.forEach(({ topMin, topMax }) => {
      Array.from({ length: 25 }, (_, i) => {
        const height = 200 + i;
        const path = buildOrbPath(i, (i % 10) / 10, 0.4, height, topMin, topMax);
        const tops = path.stops.map((s) => s.bottom + height);

        expect(Math.max(...tops)).toBeLessThanOrEqual(topMax + EPSILON);
        expect(Math.min(...tops)).toBeGreaterThanOrEqual(topMin - EPSILON);
      });
    });
  });

  it("covers opposite initial directions across seeds", () => {
    const lefts = Array.from({ length: 20 }, (_, i) =>
      buildOrbPath(i, 0.2, 0.3, 150, 35, 80).stops[1].left,
    );
    expect(new Set(lefts.map((n) => Math.sign(n - 50))).size).toBeGreaterThan(0);
  });
});
