import { describe, expect, it } from "vitest";

import { buildOrbs, clamp01 } from "@/app/_glow/build-orbs";
import { ORB_COUNT } from "@/app/_glow/glow-math";

describe("clamp01", () => {
  it("clamps below, inside, and above", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});

describe("buildOrbs", () => {
  it("emits one orb per count with rem and percent widths", () => {
    const orbs = buildOrbs();
    expect(orbs).toHaveLength(ORB_COUNT);
    expect(orbs.some((o) => o.width.endsWith("%"))).toBe(true);
    expect(orbs.some((o) => o.width.endsWith("rem"))).toBe(true);
    orbs.forEach((orb) => {
      expect(orb.ease.startsWith("cubic-bezier(")).toBe(true);
      expect(orb.stops.length).toBeGreaterThan(1);
      expect(orb.duration).toBeGreaterThan(0);
      expect(orb.delay).toBeLessThanOrEqual(0);
    });
  });
});
