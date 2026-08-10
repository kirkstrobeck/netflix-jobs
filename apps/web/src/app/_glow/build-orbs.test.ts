import { describe, expect, it } from "vitest";

import { buildOrbs, clamp01 } from "@/app/_glow/build-orbs";
import { ORB_COUNT, TOP_CEILING, TOP_FLOOR } from "@/app/_glow/glow-math";

// An orb's box top edge, in cqh above the band's bottom. The Y track carries
// the box's BOTTOM edge and the rule carries `height`, both as a percentage of
// the band, so the top edge is their sum. 100 is the band's own top edge --
// reach it and .glow's overflow: hidden cuts the orb off flat.
function boxTopEdges(orb: ReturnType<typeof buildOrbs>[number]): number[] {
  return orb.y.stops.map((stop) => stop.value + orb.height);
}

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
      [orb.x, orb.y].forEach((track) => {
        expect(track.stops.length).toBeGreaterThan(1);
        expect(track.duration).toBeGreaterThan(0);
        expect(track.delay).toBeLessThanOrEqual(0);
      });
      // Two loops that never come round together is the whole trick. Sharing a
      // duration would put the orb back on a single loop as long as one of them.
      expect(orb.x.duration).not.toBe(orb.y.duration);
    });
  });

  it("keeps every orb clear of the band's top edge", () => {
    const highest = Math.max(...buildOrbs().flatMap(boxTopEdges));

    expect(highest).toBeLessThanOrEqual(TOP_CEILING);
    // The point of the ceiling: real clearance under the clip, not tangency.
    expect(highest).toBeLessThan(100);
  });

  it("keeps every orb above the floor", () => {
    const lowest = Math.min(...buildOrbs().flatMap(boxTopEdges));

    expect(lowest).toBeGreaterThanOrEqual(TOP_FLOOR);
  });

  it("still drives orbs all the way up to the ceiling", () => {
    // A ceiling that nothing reaches would be a shorter band, not a fix.
    const highest = Math.max(...buildOrbs().flatMap(boxTopEdges));

    expect(highest).toBe(TOP_CEILING);
  });
});
