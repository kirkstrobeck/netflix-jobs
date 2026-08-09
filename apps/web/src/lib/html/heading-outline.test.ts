import { describe, expect, it } from "vitest";

import { fitHeadingOutline } from "@/lib/html/heading-outline";

describe("fitHeadingOutline", () => {
  it("renumbers the shallowest heading to the base level", () => {
    expect(fitHeadingOutline("<h1>Role</h1>", 3)).toBe("<h3>Role</h3>");
  });

  // The bug this exists for: a fragment whose own outline starts at h3, dropped
  // under our h2, used to render as h4 and skip a level.
  it("closes the gap when the source does not start at h1", () => {
    expect(fitHeadingOutline("<h3>Responsibilities</h3>", 3)).toBe(
      "<h3>Responsibilities</h3>",
    );
  });

  it("preserves relative depth across distinct levels", () => {
    expect(fitHeadingOutline("<h2>A</h2><h4>B</h4><h2>C</h2>", 3)).toBe(
      "<h3>A</h3><h4>B</h4><h3>C</h3>",
    );
  });

  it("drops an empty heading without opening a gap behind it", () => {
    expect(fitHeadingOutline("<h2></h2><h3>Real</h3>", 3)).toBe("<h3>Real</h3>");
  });

  it("treats a heading of markup with no text as empty", () => {
    expect(fitHeadingOutline("<h3><b><span> </span></b></h3>", 3)).toBe("");
  });

  it("keeps inner markup", () => {
    expect(fitHeadingOutline("<h3><b>Key</b> facts</h3>", 3)).toBe(
      "<h3><b>Key</b> facts</h3>",
    );
  });

  it("clamps at h6 rather than emitting a level that does not exist", () => {
    const deep = "<h1>a</h1><h2>b</h2><h3>c</h3><h4>d</h4><h5>e</h5>";

    expect(fitHeadingOutline(deep, 3)).toBe(
      "<h3>a</h3><h4>b</h4><h5>c</h5><h6>d</h6><h6>e</h6>",
    );
  });

  it("leaves a fragment with no headings alone", () => {
    expect(fitHeadingOutline("<p>text</p>", 3)).toBe("<p>text</p>");
  });
});
