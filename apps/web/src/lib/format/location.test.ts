import { describe, expect, it } from "vitest";

import { formatLocation, formatLocations } from "@/lib/format/location";

describe("formatLocation", () => {
  it("adds spacing after commas", () => {
    expect(formatLocation("Los Angeles,California,United States of America")).toBe(
      "Los Angeles, California, United States of America",
    );
  });

  it("filters empty parts", () => {
    expect(formatLocation("Los Angeles,,California")).toBe("Los Angeles, California");
  });
});

describe("formatLocations", () => {
  it("falls back to the scalar location when the array is empty", () => {
    expect(formatLocations([], "Los Angeles,California")).toEqual(["Los Angeles, California"]);
  });

  it("dedupes formatted entries", () => {
    expect(formatLocations(["Los Angeles,CA", "Los Angeles,CA"], "")).toEqual(["Los Angeles, CA"]);
  });

  it("filters out entries that format to an empty string", () => {
    expect(formatLocations(["", ",,"], "")).toEqual([]);
  });
});
