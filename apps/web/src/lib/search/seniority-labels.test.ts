import { describe, expect, it } from "vitest";

import { seniorityLevels } from "@/lib/search/seniority";
import { SENIORITY_LABELS } from "@/lib/search/seniority-rank";

// The panel's vocabulary, kept apart from the derivation it names. Reading a
// rung off a title is one claim; having a word on screen for every rung that
// reading can produce is another, and the second is the one a shared link
// breaks first.

describe("SENIORITY_LABELS", () => {
  // Sentence case, like every other label on the panel.
  it("names every rung in sentence case", () => {
    expect(SENIORITY_LABELS).toEqual({
      entry: "Entry level",
      mid: "Mid level",
      senior: "Senior",
      staff: "Staff and principal",
      manager: "Manager",
      director: "Director and above",
    });
  });

  // The slug in the URL and the key of the label table are the same string, or
  // a shared link renders a ticked box with no name on it.
  it("has a label for every level the derivation can return", () => {
    const derived = [
      "Software Engineer 3- Ink",
      "Software Engineer 4 - Graph Search",
      "Software Engineer 5 - Creative Studio",
      "Software Engineer 6 - Creative Studio",
      "Manager, Physical Security",
      "Director, Real Estate and Legal Affairs",
    ].flatMap((title) => seniorityLevels(title));

    expect(new Set(derived)).toEqual(new Set(Object.keys(SENIORITY_LABELS)));
  });
});
