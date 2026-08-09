import { describe, expect, it } from "vitest";

import { isVoidTag, mapTag } from "@/lib/html/policy";

describe("isVoidTag", () => {
  it("is true for void tags", () => {
    expect(isVoidTag("br")).toBe(true);
    expect(isVoidTag("hr")).toBe(true);
  });

  it("is false for non-void tags", () => {
    expect(isVoidTag("p")).toBe(false);
  });
});

describe("mapTag", () => {
  it("keeps headings at their source level for fitHeadingOutline to renumber", () => {
    expect(mapTag("h1")).toBe("h1");
    expect(mapTag("h3")).toBe("h3");
    expect(mapTag("h6")).toBe("h6");
  });

  it("passes allowed tags through unchanged", () => {
    expect(mapTag("p")).toBe("p");
    expect(mapTag("a")).toBe("a");
  });

  it("returns null for unknown tags", () => {
    expect(mapTag("div")).toBeNull();
    expect(mapTag("font")).toBeNull();
  });
});
