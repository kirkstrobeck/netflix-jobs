import { describe, expect, it } from "vitest";

import { readCss, rule, stripComments } from "@/app/(site)/css-rule";

const CSS = `
/* .a { colour: wrong } */
.a { color: red; }
.b .c::after { content: ""; }
`;

describe("stripComments", () => {
  // The (site) stylesheets carry more prose than declarations, and that prose
  // quotes selectors and properties. Left in, it answers queries about itself.
  it("drops comments before anything else looks at the text", () => {
    expect(stripComments(CSS)).not.toContain("wrong");
    expect(stripComments(CSS)).toContain("color: red");
  });
});

describe("rule", () => {
  it("returns one rule's declarations, by exact selector", () => {
    expect(rule(stripComments(CSS), ".a")).toContain("color: red");
  });

  it("matches a descendant selector whatever its whitespace", () => {
    expect(rule(CSS, ".b   .c::after")).toContain('content: ""');
  });

  // "" rather than undefined: a missing rule then fails the toContain that
  // follows, instead of throwing somewhere less legible.
  it("gives back an empty body for a selector that is not there", () => {
    expect(rule(CSS, ".nope")).toBe("");
  });
});

describe("readCss", () => {
  it("reads a stylesheet out of the (site) directory, comments stripped", () => {
    const masthead = readCss("site-masthead.css");

    expect(rule(masthead, ".site-header__inner")).toContain("min-block-size: 4.5rem");
    expect(masthead).not.toContain("/*");
  });
});
