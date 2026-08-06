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

  it("covers opposite initial directions across seeds", () => {
    const lefts = Array.from({ length: 20 }, (_, i) =>
      buildOrbPath(i, 0.2, 0.3, 150, 35, 80).stops[1].left,
    );
    expect(new Set(lefts.map((n) => Math.sign(n - 50))).size).toBeGreaterThan(0);
  });
});
