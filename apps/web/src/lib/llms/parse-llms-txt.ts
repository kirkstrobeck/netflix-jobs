// A parser for the /llms.txt format, written from the spec at llmstxt.org
// (fetched 2026-08-09). The spec states the file "contains the following
// sections as markdown, in the specific order":
//
//   1. An optional byte-order mark (BOM)
//   2. An H1 with the name of the project or site. This is the only required
//      section
//   3. A blockquote with a short summary of the project
//   4. Zero or more markdown sections (e.g. paragraphs, lists, etc) of any type
//      except headings, containing more detailed information
//   5. Zero or more markdown sections delimited by H2 headers, containing "file
//      lists" of URLs where further detail is available
//
// And: "Each 'file list' is a markdown list, containing a required markdown
// hyperlink [name](url), then optionally a `:` and notes about the file."
//
// This file only reads. Judging what it read is validate-llms-txt.ts, so the
// grammar and the rules stay separately testable.

import {
  BOM,
  foldContinuations,
  headingOf,
  readLink,
  readSummary,
  type LlmsLink,
  type SourceLine,
} from "@/lib/llms/llms-lines";

export type { LlmsLink, SourceLine };

export type LlmsSection = {
  title: string;
  level: number;
  line: number;
  links: LlmsLink[];
  // Anything in the section that is not a list item. The spec allows only file
  // lists here, so these are what the validator rejects.
  strays: SourceLine[];
};

export type LlmsDocument = {
  hadBom: boolean;
  title: string | null;
  summary: string | null;
  // Content between the H1/blockquote and the first H2.
  details: SourceLine[];
  // Content before the H1, which the spec's ordering does not allow.
  preamble: SourceLine[];
  sections: LlmsSection[];
  headings: { level: number; text: string; line: number }[];
};

function newSection(title: string, level: number, line: number): LlmsSection {
  return { title, level, line, links: [], strays: [] };
}

// Non-list content is recorded wherever it was found, because the spec allows it
// in exactly one of the three places.
function strayTarget(doc: LlmsDocument, section: LlmsSection | null): SourceLine[] {
  if (section) {
    return section.strays;
  }

  if (doc.title === null) {
    return doc.preamble;
  }

  return doc.details;
}

export function parseLlmsTxt(source: string): LlmsDocument {
  const hadBom = source.startsWith(BOM);
  const body = hadBom ? source.slice(1) : source;
  const lines = foldContinuations(
    body.split("\n").map((text, index) => ({ text, line: index + 1 })),
  );

  const doc: LlmsDocument = {
    hadBom,
    title: null,
    summary: null,
    details: [],
    preamble: [],
    sections: [],
    headings: [],
  };

  let section: LlmsSection | null = null;
  let index = 0;

  while (index < lines.length) {
    const entry = lines[index];
    const heading = headingOf(entry.text);

    if (heading) {
      doc.headings.push({ ...heading, line: entry.line });
    }

    // The first H1 is the title, and the blockquote that follows it is consumed
    // in the same step so a quote further down the file is not mistaken for it.
    if (heading?.level === 1 && doc.title === null) {
      doc.title = heading.text;

      const read = readSummary(lines, index + 1);
      doc.summary = read.summary;
      index = read.next;
      continue;
    }

    if (heading) {
      section = newSection(heading.text, heading.level, entry.line);
      doc.sections.push(section);
      index += 1;
      continue;
    }

    const link = section ? readLink(entry) : null;

    if (section && link) {
      section.links.push(link);
      index += 1;
      continue;
    }

    if (entry.text.trim()) {
      strayTarget(doc, section).push(entry);
    }

    index += 1;
  }

  return doc;
}
