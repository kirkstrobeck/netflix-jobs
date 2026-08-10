import { describe, expect, it } from "vitest";

import {
  buildWalk,
  hopDuration,
  LOOP_Y_MAX_S,
  mix,
  ORB_COUNT,
  TRAVEL_Y_MAX,
  TRAVEL_Y_MIN,
  type WalkSpec,
} from "@/app/_glow/glow-math";

// One axis of one orb, with only the parts a case cares about spelled out.
const walk = (over: Partial<WalkSpec> = {}) =>
  buildWalk({
    seed: 0,
    axis: 1,
    size: 0.5,
    lo: 30,
    hi: 90,
    travelMin: TRAVEL_Y_MIN,
    travelMax: TRAVEL_Y_MAX,
    target: LOOP_Y_MAX_S,
    ...over,
  });

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

describe("buildWalk", () => {
  it("builds closed loops for many seeds and sizes", () => {
    const walks = Array.from({ length: ORB_COUNT }, (_, i) =>
      walk({ seed: i, size: (i % 10) / 10 }),
    );
    walks.forEach((path) => {
      expect(path.stops[0].at).toBe(0);
      expect(path.stops[path.stops.length - 1].at).toBe(100);
      expect(path.duration).toBeGreaterThan(0);
      expect(path.stops.length).toBeGreaterThan(1);
    });
  });

  // The sheet is the sum of these. A walk of 26 seconds at roughly two seconds
  // a hop is a dozen or so stops, and that ratio is the whole reason the
  // stylesheet is 156KB instead of 785KB -- if a walk ever came back with a
  // hundred stops again, so would the file.
  it("spends about a dozen stops on a loop, not a hundred", () => {
    const counts = Array.from({ length: ORB_COUNT }, (_, i) =>
      walk({ seed: i, size: (i % 10) / 10 }).stops.length,
    );

    expect(Math.max(...counts)).toBeLessThan(40);
    expect(Math.min(...counts)).toBeGreaterThan(3);
  });

  it("covers bounce and direction flips with tight bounds", () => {
    expect(walk({ seed: 7, lo: 40, hi: 45 }).stops.length).toBeGreaterThan(5);
  });

  // Only the X walk carries the flame, and it carries one reading per stop.
  it("puts an opacity on the stops that were asked for one", () => {
    expect(walk().stops.every((s) => s.opacity === undefined)).toBe(true);
    expect(walk({ peak: 0.4 }).stops.every((s) => typeof s.opacity === "number")).toBe(
      true,
    );
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

    // The walk rounds each hop to 2dp, so a value clamped exactly to 55.4 can
    // come back as 55.400000000000006. Hence the epsilon -- it is rounding
    // noise, not slack in the clamp.
    const EPSILON = 0.001;

    cases.forEach(({ topMin, topMax }) => {
      Array.from({ length: 25 }, (_, i) => {
        const tops = walk({
          seed: i,
          size: (i % 10) / 10,
          lo: topMin,
          hi: topMax,
        }).stops.map((s) => s.value);

        expect(Math.max(...tops)).toBeLessThanOrEqual(topMax + EPSILON);
        expect(Math.min(...tops)).toBeGreaterThanOrEqual(topMin - EPSILON);
      });
    });
  });

  it("covers opposite initial directions across seeds", () => {
    const seconds = Array.from({ length: 20 }, (_, i) =>
      walk({ seed: i, lo: 35, hi: 80 }).stops[1].value,
    );
    expect(new Set(seconds.map((n) => Math.sign(n - 50))).size).toBeGreaterThan(0);
  });
});
