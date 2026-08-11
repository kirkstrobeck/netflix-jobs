import { describe, expect, it } from "vitest";

import { readCss, rule } from "@/app/(site)/css-rule";

/**
 * THE PLACES LIST MARKERS, ASSERTED IN THE STYLESHEET.
 *
 * Separate from job-details.test.tsx because nothing here renders a component:
 * these read a file. The render suite was also at the 200-line ceiling, and a
 * stylesheet assertion is the part of it that never needed React.
 *
 * The declarations these cover shipped wrong, and the comment above them
 * claimed the opposite of what they did: `inside` was justified on the grounds
 * that a wrapped line would then indent under the text, when `inside` is
 * precisely what sends it back to the content edge, LEFT of the marker. At
 * 390px 'Los Angeles, California, United States' wraps, and it read as two
 * items rather than one.
 *
 * A prose comment cannot fail. Read off the file, these can.
 *
 * The suite runs in jsdom with css: false, so there is no cascade here to query
 * -- the text is the only thing there is to assert. The alignment itself is
 * arithmetic on client rects in a real engine: tools/probe/places.mjs.
 */
describe("the places list markers", () => {
  const css = readCss("jobs/[jobid]/job-details.css");
  const list = rule(css, ".detail-places");

  // `outside` said out loud rather than left to the UA default, because the
  // value this rule used to carry is the bug, and a rule that says nothing
  // cannot be told apart from a rule nobody has looked at yet.
  it("hangs the marker outside the content box", () => {
    expect(list).toContain("outside");
    expect(list).not.toContain("inside");
  });

  // Outside only hangs into padding the list actually has. At padding: 0 the
  // marker hangs into the card's own padding instead, and the list stops
  // lining up with the six values above it.
  it("gives the marker padding of its own to hang into", () => {
    expect(list).toMatch(
      /padding:[^;]*1\.125rem|padding-inline-start:\s*1\.125rem/,
    );
  });

  it("draws squares, not the default discs", () => {
    expect(list).toContain("square");
    expect(list).not.toContain("disc");
  });

  // The token, not a second literal. #e50914 is spelled once, on .job-page in
  // job-shell.css, and every other marker on the site reaches it the same way.
  it("colours the marker through the accent token", () => {
    expect(rule(css, ".detail-places__item::marker")).toContain(
      "color: var(--accent)",
    );
    expect(css).not.toContain("#e50914");
  });

  /**
   * `balance`, and specifically not `pretty`.
   *
   * A place name is a display block: two lines in this column at both 390px and
   * 1280px. Left alone, 'Los Angeles, California, United States' broke 231px
   * then 48px and the word 'roles' sat under it looking like a second item --
   * raggedness 91.50, measured with tools/probe/wrap.mjs, 37.50 after this rule.
   *
   * pretty would be the wrong half of the property: it moves the last line only,
   * and across two lines that shortens one without lengthening the other.
   */
  it("balances the two lines of a place name rather than prettifying them", () => {
    const item = rule(css, ".detail-places__item");

    expect(item).toContain("text-wrap: balance");
    expect(item).not.toContain("pretty");
  });
});
