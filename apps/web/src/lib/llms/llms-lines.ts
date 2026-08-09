// Line-level readers for the llms.txt grammar. Split from parse-llms-txt.ts so
// each markdown construct the spec names -- heading, blockquote, file-list item
// -- is one small function that can be read against the sentence it comes from.

export type SourceLine = { text: string; line: number };

export type LlmsLink = { name: string; url: string; notes: string | null; line: number };

export const BOM = String.fromCharCode(0xfeff);

const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;
const QUOTE = /^>\s?(.*)$/;
// "a required markdown hyperlink [name](url), then optionally a `:` and notes
// about the file."
const ITEM = /^[-*]\s+\[([^\]]*)\]\(([^)\s]*)\)\s*(?::\s*(.*))?$/;
const CONTINUATION = /^\s+\S/;

export function headingOf(text: string) {
  const match = HEADING.exec(text);

  return match ? { level: match[1].length, text: match[2] } : null;
}

// A wrapped list item continues the previous one: "- [name](url): notes" whose
// notes run past the margin. Folding it back in is what lets the item regex stay
// anchored to a single line.
export function foldContinuations(lines: SourceLine[]): SourceLine[] {
  const folded: SourceLine[] = [];

  lines.forEach((entry) => {
    const previous = folded[folded.length - 1];
    const joins = previous && CONTINUATION.test(entry.text) && ITEM.test(previous.text);

    if (joins) {
      previous.text = `${previous.text} ${entry.text.trim()}`;
      return;
    }

    folded.push({ ...entry });
  });

  return folded;
}

export function readLink(entry: SourceLine): LlmsLink | null {
  const match = ITEM.exec(entry.text);

  if (!match) {
    return null;
  }

  return {
    name: match[1],
    url: match[2],
    notes: match[3] ? match[3].trim() : null,
    line: entry.line,
  };
}

// The blockquote the spec puts directly after the H1. A blank line may sit
// between the heading and the quote, because markdown needs one; once the quote
// has started, the next line that is not quoted ends it.
export function readSummary(lines: SourceLine[], start: number) {
  const quoted: string[] = [];
  let index = start;

  while (index < lines.length) {
    const match = QUOTE.exec(lines[index].text);

    if (match) {
      quoted.push(match[1].trim());
      index += 1;
      continue;
    }

    if (lines[index].text.trim() || quoted.length > 0) {
      break;
    }

    index += 1;
  }

  return { summary: quoted.length > 0 ? quoted.join(" ").trim() : null, next: index };
}
