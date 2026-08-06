import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/app/(site)/site-header";
import { WORDMARK_RED } from "@/app/(site)/wordmark";

describe("SiteHeader", () => {
  it("renders a skip link that targets the main content landmark", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('class="skip-link"');
    expect(html).toContain('href="#site-main"');
    expect(html).toContain("Skip to main content");
  });

  it("renders the Netflix Jobs wordmark linking to the home page", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('class="wordmark"');
    expect(html).toContain('href="/"');
    expect(html).toContain('alt="Netflix"');
    expect(html).toContain(">Jobs</span>");
  });

  // Red on the masthead's flat surface, and eager because it is above the fold.
  it("uses the red mark, loaded eagerly", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain(WORDMARK_RED);
    expect(html).toContain('loading="eager"');
  });
});
