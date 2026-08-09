import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The row's interaction state is entirely CSS -- there is no class toggle and no
// JavaScript -- so the stylesheet is the thing under test.
const css = readFileSync(
  join(process.cwd(), "src/app/(site)/_listing/result-row.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

// Split into rules and look them up by their EXACT selector text. Matching by
// substring instead would let ".result" find ".results", and ".result::after"
// find a grouped rule that merely mentions it.
const normalise = (selector: string) => selector.trim().replace(/\s+/g, " ");

const RULES = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: normalise(match[1]),
  body: match[2],
}));

const rule = (selector: string) =>
  RULES.find((entry) => entry.selector === normalise(selector))?.body ?? "";

const ON = ".result:is(:hover, :has(.result__link:focus-visible))";

// Every rule that paints the hovered state, keyed by the selector it is
// actually written under.
const STATE_RULES = [`${ON}::after`, `${ON} .result__link`, `${ON} .result__date`];

describe("result row hover treatment", () => {
  // The whole row is the target. Scoping the state to .result means hovering
  // the date lights the row exactly as hovering the title does.
  it("keys every part of the state off the row, not the title link", () => {
    STATE_RULES.forEach((selector) => {
      expect(rule(selector)).not.toBe("");
    });
    // The old title-only hover is gone: the row owns the state now.
    expect(css).not.toContain(".result__link:hover");
  });

  // :focus-within would also match after a mouse click, leaving a row lit that
  // nobody is on.
  it("uses :focus-visible for the keyboard state, never :focus-within", () => {
    expect(css).toContain(":has(.result__link:focus-visible)");
    expect(css).not.toContain(":focus-within");
  });

  it("gives pointer and keyboard the identical treatment", () => {
    // Both live in one :is(), so they cannot drift apart. One per state rule,
    // plus the rule that holds "Not listed" faint through the state.
    const paired = css.match(/:is\(:hover, :has\(\.result__link:focus-visible\)\)/g);

    expect(paired?.length).toBe(STATE_RULES.length + 1);
  });

  // The style guide, both halves: the base rule owns the way out and carries a
  // duration; the state rule owns the way in and zeroes it.
  it("appears instantly and only fades on the way out", () => {
    expect(rule(".result__link")).toContain("transition: text-decoration-color 150ms ease");
    expect(rule(".result__date")).toContain("transition: color 150ms ease");
    expect(rule(".result::after")).toContain("transition: opacity 150ms ease");

    STATE_RULES.forEach((selector) => {
      expect(rule(selector)).toContain("transition-duration: 0s");
    });
  });

  // Re-judged for a one-line row: the wash that lit the old four-line block is
  // gone, because a fill behind a single line is a menu highlight -- a card at
  // reduced height, which is what this list exists not to be.
  it("is a gutter mark and an underline, with no wash behind the row", () => {
    expect(rule(".result::after")).toContain("background: var(--accent)");
    expect(rule(".result::after")).toContain("inset-inline-start: -0.75rem");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("::before");
  });

  // Both marks are --accent, so the state reads as one gesture: the mark says
  // which row, the underline says what will open.
  it("underlines the title in the same accent the mark uses", () => {
    expect(rule(`${ON} .result__link`)).toContain("text-decoration-color: var(--accent)");
    expect(rule(".result__link")).toContain("text-decoration-color: transparent");
  });

  // Nothing animated may reflow: no padding, margin, border or size changes.
  it("cannot shift the layout", () => {
    STATE_RULES.forEach((selector) => {
      expect(rule(selector)).not.toMatch(/padding|margin|border-width|font-size/);
    });
  });

  // Opacity and colour only. The mark's scaleY retract went with the wash: over
  // one line it was a twitch, and twenty rows of it would leave a trail of
  // movement behind a pointer running down the list.
  it("moves nothing, so it needs no reduced-motion branch", () => {
    expect(css).not.toContain("transform");
    expect(css).not.toContain("prefers-reduced-motion");
  });

  // The list separates with hairlines and nothing else; a hovered row must not
  // start drawing a box.
  it("adds no border on hover", () => {
    STATE_RULES.forEach((selector) => {
      expect(rule(selector)).not.toContain("border");
    });
  });
});
