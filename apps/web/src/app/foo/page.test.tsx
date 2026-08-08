import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Base from "@/app/foo/page";

// The markup here is two bare divs -- every requirement this route exists to
// prove (black, 300px, full width, 50px down) lives in page.css, so asserting
// only the rendered HTML would assert nothing. Read the stylesheet too.
// Comments stripped first -- page.css explains itself at length, and the
// "no width declaration" assertions below would match the prose saying so.
const css = readFileSync(join(process.cwd(), "src/app/foo/page.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function rule(selector: string): string {
  return css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("foo prototype page", () => {
  it("renders the band inside the field", () => {
    const html = renderToStaticMarkup(<Base />);

    expect(html).toBe('<div class="foo-field"><div class="foo-band"></div></div>');
  });

  it("paints the field black", () => {
    expect(rule(".foo-field")).toContain("background: #000000");
  });

  // Padding rather than a margin on the band: a margin-top on an only child
  // collapses through the field and moves the field instead of the band.
  it("holds the band 50px down without collapsing the gap out of the field", () => {
    expect(rule(".foo-field")).toContain("padding-top: 50px");
    expect(rule(".foo-band")).not.toContain("margin");
  });

  it("gives the band 300px of Netflix red", () => {
    expect(rule(".foo-band")).toContain("height: 300px");
    expect(rule(".foo-band")).toContain("background: #e50914");
  });

  // Full width comes from the band being a block box in a field with no
  // padding-inline. A width declaration on either would be what breaks it.
  it("leaves the band full width", () => {
    expect(rule(".foo-band")).not.toContain("width");
    expect(rule(".foo-field")).not.toContain("padding-inline");
  });
});
