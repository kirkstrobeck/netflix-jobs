import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { validateLlmsTxt } from "@/lib/llms/validate-llms-txt";

const SPEC_EXAMPLE = `# Title

> Optional description goes here

Optional details go here

## Section name

- [Link title](https://link_url): Optional link details

## Optional

- [Link title](https://link_url)
`;

// Vitest's root is apps/web, so this is the file the site actually serves at
// /llms.txt -- not a copy of it that could pass while the real one rots.
const shipped = () => readFileSync(resolve(process.cwd(), "public/llms.txt"), "utf8");

describe("validateLlmsTxt", () => {
  it("passes the example the spec prints", () => {
    expect(validateLlmsTxt(SPEC_EXAMPLE)).toEqual([]);
  });

  it("passes the file this site serves", () => {
    expect(validateLlmsTxt(shipped())).toEqual([]);
  });

  it("fails a file with no H1", () => {
    expect(validateLlmsTxt("> just a summary\n")).toContain(
      "no H1: the file must open with an H1 naming the site",
    );
  });

  it("fails content before the H1 and a second H1 after it", () => {
    const out = validateLlmsTxt("intro\n\n# Title\n\n> s\n\n# Again\n").join(" | ");

    expect(out).toContain("content before the H1");
    expect(out).toContain("a second H1");
  });

  // The blockquote is the check the file this repo shipped could not pass.
  it("fails a file with no blockquote summary", () => {
    expect(validateLlmsTxt("# Title\n\nsome prose\n")).toContain(
      "no blockquote summary directly after the H1",
    );
  });

  it("fails a summary too long to be a short summary", () => {
    const long = `# T\n\n> ${"word ".repeat(120)}\n`;

    expect(validateLlmsTxt(long).join(" | ")).toContain("short summary");
  });

  it("fails headings the spec does not define", () => {
    expect(validateLlmsTxt("# T\n\n> s\n\n### Deep\n\n- [a](/a)\n").join(" | ")).toContain(
      "only H1 and H2 are defined",
    );
  });

  // The other failure in the shipped file: a closing paragraph inside a section
  // whose grammar allows a file list and nothing else.
  it("fails prose inside an H2 section", () => {
    const out = validateLlmsTxt("# T\n\n> s\n\n## S\n\n- [a](/a)\n\nand a closing note\n");

    expect(out.join(" | ")).toContain("contains prose");
  });

  it("fails an empty section and a link missing its name or URL", () => {
    expect(validateLlmsTxt("# T\n\n> s\n\n## Empty\n").join(" | ")).toContain("has no links");
    expect(validateLlmsTxt("# T\n\n> s\n\n## S\n\n- [](/a)\n").join(" | ")).toContain(
      "link has no name",
    );
    expect(validateLlmsTxt("# T\n\n> s\n\n## S\n\n- [a]()\n").join(" | ")).toContain("has no URL");
  });
});
