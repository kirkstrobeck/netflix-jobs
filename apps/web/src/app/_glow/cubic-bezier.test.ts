import { describe, expect, it } from "vitest";

import { cubicBezier } from "@/app/_glow/cubic-bezier";

describe("cubicBezier", () => {
  it("clamps x at the endpoints", () => {
    expect(cubicBezier(0.12, 0.72, 0.22, 1, -0.5)).toBe(0);
    expect(cubicBezier(0.12, 0.72, 0.22, 1, 0)).toBe(0);
    expect(cubicBezier(0.12, 0.72, 0.22, 1, 1)).toBe(1);
    expect(cubicBezier(0.12, 0.72, 0.22, 1, 1.5)).toBe(1);
  });

  it("interpolates interior samples on the wash curve", () => {
    const mid = cubicBezier(0.12, 0.72, 0.22, 1, 0.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("returns early when the x-curve derivative is flat", () => {
    expect(cubicBezier(0, 0, 0, 1, 0.5)).toBeTypeOf("number");
  });

  it("exhausts Newton steps on a stiff curve", () => {
    const y = cubicBezier(1, 0, 0, 1, 0.5);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(1);
  });
});
