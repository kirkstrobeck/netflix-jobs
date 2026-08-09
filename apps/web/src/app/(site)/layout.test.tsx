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
});
