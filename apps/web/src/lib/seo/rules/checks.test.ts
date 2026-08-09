import { describe, expect, it } from "vitest";

import {
  asList,
  isAbsoluteUrl,
  isIso8601,
  isNode,
  isText,
  must,
  typeOf,
} from "@/lib/seo/rules/checks";

describe("checks", () => {
  it("tells a JSON-LD node from an array, a null and a scalar", () => {
    expect(isNode({ "@type": "Place" })).toBe(true);
    expect(isNode([])).toBe(false);
    expect(isNode(null)).toBe(false);
    expect(isNode("Place")).toBe(false);
  });

  it("treats blank text as absent", () => {
    expect(isText("Netflix")).toBe(true);
    expect(isText("   ")).toBe(false);
    expect(isText(7)).toBe(false);
  });

  // Any JSON-LD property may hold one value or many, so every rule reads both.
  it("reads one value and many the same way", () => {
    expect(asList(["a", "b"])).toEqual(["a", "b"]);
    expect(asList("a")).toEqual(["a"]);
    expect(asList(undefined)).toEqual([]);
  });

  it("reads @type only off a node with a string one", () => {
    expect(typeOf({ "@type": "Place" })).toBe("Place");
    expect(typeOf({ "@type": ["Place"] })).toBeNull();
    expect(typeOf("Place")).toBeNull();
  });

  it("requires a URL to carry its scheme and host", () => {
    expect(isAbsoluteUrl("https://www.netflix.com")).toBe(true);
    expect(isAbsoluteUrl("http://localhost:3000/icon1.png")).toBe(true);
    expect(isAbsoluteUrl("/icon1.png")).toBe(false);
    expect(isAbsoluteUrl("https:// spaced.example")).toBe(false);
    expect(isAbsoluteUrl(42)).toBe(false);
  });

  it("accepts the ISO 8601 spellings Google's examples use", () => {
    expect(isIso8601("2016-02-18")).toBe(true);
    expect(isIso8601("2017-02-24T19:33:17+00:00")).toBe(true);
    expect(isIso8601("2017-03-18T00:00")).toBe(true);
    expect(isIso8601("2017-03-18T00:00:00.500Z")).toBe(true);
  });

  it("rejects a date that is only shaped like one", () => {
    expect(isIso8601("2026-02-31")).toBe(false);
    expect(isIso8601("2026-13-01")).toBe(false);
    expect(isIso8601("18/02/2016")).toBe(false);
    expect(isIso8601(20160218)).toBe(false);
  });

  it("collects only the failures", () => {
    const out: string[] = [];

    must(out, true, "kept quiet");
    must(out, false, "spoke up");

    expect(out).toEqual(["spoke up"]);
  });
});
