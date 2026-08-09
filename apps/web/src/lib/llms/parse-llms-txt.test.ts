import { describe, expect, it } from "vitest";

import { parseLlmsTxt } from "@/lib/llms/parse-llms-txt";

// The spec's own mock example, verbatim from llmstxt.org. If the parser cannot
// read the file the spec prints, nothing else it says is worth much.
const SPEC_EXAMPLE = `# Title

> Optional description goes here

Optional details go here

## Section name

- [Link title](https://link_url): Optional link details

## Optional

- [Link title](https://link_url)
`;

describe("parseLlmsTxt", () => {
  it("reads the example printed in the spec", () => {
    const doc = parseLlmsTxt(SPEC_EXAMPLE);

    expect(doc.title).toBe("Title");
    expect(doc.summary).toBe("Optional description goes here");
    expect(doc.details.map((line) => line.text)).toEqual(["Optional details go here"]);
    expect(doc.sections.map((section) => section.title)).toEqual([
      "Section name",
      "Optional",
    ]);
    expect(doc.sections[0].links).toEqual([
      {
        name: "Link title",
        url: "https://link_url",
        notes: "Optional link details",
        line: 9,
      },
    ]);
    expect(doc.sections[1].links[0].notes).toBeNull();
  });

  it("strips an optional byte-order mark", () => {
    const doc = parseLlmsTxt(`${String.fromCharCode(0xfeff)}# Title\n`);

    expect(doc.hadBom).toBe(true);
    expect(doc.title).toBe("Title");
  });

  it("joins a list item that wraps across lines", () => {
    const doc = parseLlmsTxt("# T\n\n## S\n\n- [Board](/api/board): every active\n  posting, newest first\n");

    expect(doc.sections[0].links[0].notes).toBe("every active posting, newest first");
    expect(doc.sections[0].strays).toEqual([]);
  });

  it("records content that sits before the H1", () => {
    const doc = parseLlmsTxt("stray line\n\n# Title\n");

    expect(doc.preamble.map((line) => line.text)).toEqual(["stray line"]);
  });

  it("records prose inside an H2 section separately from its links", () => {
    const doc = parseLlmsTxt("# T\n\n## S\n\n- [a](/a)\n\nloose paragraph\n");

    expect(doc.sections[0].links).toHaveLength(1);
    expect(doc.sections[0].strays.map((line) => line.text)).toEqual(["loose paragraph"]);
  });

  it("keeps a blockquote that is not the summary out of the summary", () => {
    const doc = parseLlmsTxt("# T\n\ndetails\n\n> a quote further down\n");

    expect(doc.summary).toBeNull();
    expect(doc.details).toHaveLength(2);
  });

  it("joins a blockquote that runs over several lines", () => {
    const doc = parseLlmsTxt("# T\n\n> one\n> two\n");

    expect(doc.summary).toBe("one two");
  });

  it("notes every heading it passed, at whatever level", () => {
    const doc = parseLlmsTxt("# T\n\n## S\n\n### Deep\n\n# Second\n");

    expect(doc.headings.map((heading) => heading.level)).toEqual([1, 2, 3, 1]);
    expect(doc.title).toBe("T");
  });
});
