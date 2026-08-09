import { parseLlmsTxt, type LlmsDocument, type LlmsSection } from "@/lib/llms/parse-llms-txt";

// The llms.txt spec as constraints, quoted from llmstxt.org (fetched
// 2026-08-09). Ordering matters as much as content -- the spec lists its five
// parts "in the specific order" -- so the rules check position, not just
// presence.
//
// Two of these caught the file this repo shipped: it had no blockquote at all,
// and it closed with a paragraph inside an H2 section, where the spec allows
// only a file list.

const MAX_SUMMARY = 500;

function checkShape(doc: LlmsDocument, out: string[]): void {
  // "An H1 with the name of the project or site. This is the only required
  // section."
  if (!doc.title) {
    out.push("no H1: the file must open with an H1 naming the site");
  }

  if (doc.preamble.length > 0) {
    out.push(`line ${doc.preamble[0].line}: content before the H1`);
  }

  const extraH1 = doc.headings.filter((heading) => heading.level === 1).slice(1);

  extraH1.forEach((heading) => {
    out.push(`line ${heading.line}: a second H1 ("${heading.text}")`);
  });

  // "A blockquote with a short summary of the project, containing key
  // information necessary for understanding the rest of the file."
  if (!doc.summary) {
    out.push("no blockquote summary directly after the H1");
  }

  if (doc.summary && doc.summary.length > MAX_SUMMARY) {
    out.push(`the blockquote summary is ${doc.summary.length} characters; the spec asks for "a short summary"`);
  }
}

function checkHeadings(doc: LlmsDocument, out: string[]): void {
  // The spec names exactly two heading levels: the H1 title and the H2 section
  // delimiters. Nothing else has a defined meaning, so nothing else belongs.
  doc.headings
    .filter((heading) => heading.level > 2)
    .forEach((heading) => {
      out.push(`line ${heading.line}: H${heading.level} ("${heading.text}") -- only H1 and H2 are defined`);
    });

  // "Zero or more markdown sections (e.g. paragraphs, lists, etc) of ANY TYPE
  // EXCEPT HEADINGS" is what may sit between the H1 and the first H2 -- so a
  // heading is what ends that region, which the parser already relies on.
  doc.sections
    .filter((section) => section.level !== 2)
    .forEach((section) => {
      out.push(`line ${section.line}: section "${section.title}" must be an H2`);
    });
}

function checkSection(section: LlmsSection, out: string[]): void {
  // "Zero or more markdown sections delimited by H2 headers, containing 'file
  // lists' of URLs where further detail is available."
  section.strays.forEach((stray) => {
    out.push(
      `line ${stray.line}: "${section.title}" contains prose; an H2 section holds a file list only`,
    );
  });

  if (section.links.length === 0 && section.strays.length === 0) {
    out.push(`line ${section.line}: section "${section.title}" has no links`);
  }

  // "Each 'file list' is a markdown list, containing a required markdown
  // hyperlink [name](url), then optionally a `:` and notes about the file."
  section.links.forEach((link) => {
    if (!link.name.trim()) {
      out.push(`line ${link.line}: link has no name`);
    }

    if (!link.url.trim()) {
      out.push(`line ${link.line}: link "${link.name}" has no URL`);
    }
  });
}

/**
 * Check a raw llms.txt against the spec's grammar.
 *
 * Returns one message per violation, empty when the file conforms. It does not
 * fetch the URLs -- that is the gate's job, where a running server exists.
 */
export function validateLlmsTxt(source: string): string[] {
  const doc = parseLlmsTxt(source);
  const out: string[] = [];

  checkShape(doc, out);
  checkHeadings(doc, out);
  doc.sections.forEach((section) => checkSection(section, out));

  return out;
}
