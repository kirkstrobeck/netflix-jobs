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
// find the ".result::before, .result::after" group.
const normalise = (selector: string) => selector.trim().replace(/\s+/g, " ");

const RULES = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: normalise(match[1]),
  body: match[2],
}));

const rule = (selector: string) =>
  RULES.find((entry) => entry.selector === normalise(selector))?.body ?? "";

const ON = ".result:is(:hover, :has(.result__link:focus-visible))";

// Every rule that paints the hovered state, keyed by the selector it is
// actually written under -- the two pseudo-elements share one grouped rule.
const STATE_RULES = [
  `${ON}::before, ${ON}::after`,
  `${ON} .result__link`,
  `${ON} .result__value`,
  `${ON} .result__label`,
];

describe("result row hover treatment", () => {
  // The whole row is the target. Scoping the state to .result means hovering
  // the facts lights the row exactly as hovering the title does.
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
    // Both live in one :is(), so they cannot drift apart.
    const paired = css.match(/:is\(:hover, :has\(\.result__link:focus-visible\)\)/g);

    // One per state rule, plus one extra because the pseudo-elements' rule
    // spells the row selector twice -- once for ::before, once for ::after.
    expect(paired?.length).toBe(STATE_RULES.length + 1);
  });

  // The style guide, both halves: the base rule owns the way out and carries a
  // duration; the state rule owns the way in and zeroes it.
  it("appears instantly and only fades on the way out", () => {
    expect(rule(".result__link")).toContain("transition: text-decoration-color 150ms ease");
    expect(rule(".result__value")).toContain("transition: color 150ms ease");
    expect(rule(".result__label")).toContain("transition: color 150ms ease");

    STATE_RULES.forEach((selector) => {
      expect(rule(selector)).toContain("transition-duration: 0s");
    });
  });

  // A flat fill would put its edges on the text edges and turn the row into a
  // card, which is what the list is built to avoid.
  it("is a gutter mark and a dissolving wash, not a background swap", () => {
    expect(rule(".result::before")).toContain("linear-gradient");
    expect(rule(".result::after")).toContain("background: var(--accent)");
    expect(rule(".result::before,\n.result::after")).toContain("inset-inline-start: -0.75rem");
  });

  // z-index: -1 keeps the layers under the row's text; isolation keeps that
  // negative layer from escaping to an ancestor stacking context.
  it("keeps the drawn layers behind the row's own text", () => {
    expect(rule(".result::before,\n.result::after")).toContain("z-index: -1");
    expect(rule(".result")).toContain("isolation: isolate");
    expect(rule(".result")).toContain("position: relative");
  });

  // Nothing animated may reflow: no padding, margin, border or size changes.
  it("cannot shift the layout", () => {
    STATE_RULES.forEach((selector) => {
      expect(rule(selector)).not.toMatch(/padding|margin|border-width|font-size/);
    });
  });

  it("drops the movement under reduced motion but keeps the mark", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");

    const reduced = css.match(/prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(reduced).toContain("transform: none");
  });

  // The list separates with hairlines and nothing else; a hovered row must not
  // start drawing a box.
  it("adds no border on hover", () => {
    STATE_RULES.forEach((selector) => {
      expect(rule(selector)).not.toContain("border");
    });
  });
});
