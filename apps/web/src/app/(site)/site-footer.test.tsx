import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/app/(site)/site-footer";
import { WORDMARK_RED } from "@/app/(site)/wordmark";

const EXPECTED_LINKS = [
  "https://about.netflix.com/en",
  "https://jobs.netflix.com/candidate-privacy",
  "https://jobs.netflixhouse.com/",
  "https://jobs.netflix.com/dnssi",
];

describe("SiteFooter", () => {
  it("renders the ambient glow", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    expect(html).toContain('class="glow"');
  });

  it("renders all four external links, each opened safely in a new tab", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    EXPECTED_LINKS.forEach((href) => {
      expect(html).toContain(`href="${href}"`);
    });
    expect(html.match(/target="_blank"/g)?.length).toBe(EXPECTED_LINKS.length);
    expect(html.match(/rel="noopener noreferrer"/g)?.length).toBe(EXPECTED_LINKS.length);
  });

  // The same red mark the masthead loads, lazily because it is below the fold.
  it("renders the red wordmark, loaded lazily", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    expect(html).toContain(WORDMARK_RED);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('class="wordmark job-footer__wordmark"');
  });
});
