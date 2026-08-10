import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FooterDefault from "@/app/(site)/@footer/default";
import HeaderDefault from "@/app/(site)/@header/default";
import SiteLayout from "@/app/(site)/layout";

// The chrome arrives as slots now, so the layout is rendered here the way the
// router renders it: with whatever the @header and @footer slots resolved to.
// These are the defaults -- the ones every route that is not the listing gets.
function renderLayout(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <SiteLayout footer={<FooterDefault />} header={<HeaderDefault />}>
      {children}
    </SiteLayout>,
  );
}

describe("SiteLayout", () => {
  it("renders the site header, the children, and the site footer in order", () => {
    const html = renderLayout(<p>child content</p>);

    const headerIndex = html.indexOf("site-header");
    const mainIndex = html.indexOf("child content");
    const footerIndex = html.indexOf("job-footer");

    expect(headerIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(mainIndex);
    expect(mainIndex).toBeLessThan(footerIndex);
  });

  it('renders the children inside a main landmark identified as "site-main"', () => {
    const html = renderLayout(null);

    expect(html).toContain("<main");
    expect(html).toContain('id="site-main"');
  });

  /**
   * <main> must NOT carry .shell, and that is a layout mechanism rather than a
   * tidy-up.
   *
   * The 76rem cap used to sit here, which made every page a column and left the
   * home masthead's divider as wide as the text above it. The cap moved down to
   * the boxes that want a measure -- the posting's article, the listing's body
   * -- so that a band placed directly in <main> stretches to the page's own
   * inline size and its border reaches the edges. Putting .shell back here
   * would undo the full-bleed silently: nothing would look broken, the divider
   * would just quietly stop at the column again.
   *
   * Sized by the layout, so the scrollbar is already accounted for. The 100vw
   * this replaced was not: it measures the viewport, gutter included.
   */
  it("leaves the width cap off main so a band inside it can span the page", () => {
    const html = renderLayout(null);

    expect(html).toContain('<main class="site-main"');
    expect(html).not.toContain("shell site-main");
  });
});
