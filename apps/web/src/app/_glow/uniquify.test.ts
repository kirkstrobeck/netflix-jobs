import { describe, expect, it } from "vitest";

import { uniquify } from "@/app/_glow/uniquify";

describe("uniquify", () => {
  it("keeps already-unique values", () => {
    expect(uniquify([1.1, 2.2, 3.3], 1)).toEqual([1.1, 2.2, 3.3]);
  });

  it("bumps collisions by the digit step", () => {
    expect(uniquify([1, 1, 1], 0)).toEqual([1, 2, 3]);
  });

  it("falls back to the raw value after 80 collisions", () => {
    const blocked = Array.from({ length: 80 }, (_, k) => k);
    const out = uniquify([...blocked, 0], 0);
    expect(out[out.length - 1]).toBe(0);
  });
});
