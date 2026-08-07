import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SiteLayout from "@/app/(site)/layout";

describe("SiteLayout", () => {
  it("renders the site header, the children, and the site footer in order", () => {
    const html = renderToStaticMarkup(
      <SiteLayout>
        <p>child content</p>
      </SiteLayout>,
    );

    const headerIndex = html.indexOf("site-header");
    const mainIndex = html.indexOf("child content");
    const footerIndex = html.indexOf("job-footer");

    expect(headerIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(mainIndex);
    expect(mainIndex).toBeLessThan(footerIndex);
  });

  it('renders the children inside a main landmark identified as "site-main"', () => {
    const html = renderToStaticMarkup(<SiteLayout>{null}</SiteLayout>);

    expect(html).toContain("<main");
    expect(html).toContain('id="site-main"');
  });
});
