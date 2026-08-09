import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readCss, rule, stripComments } from "@/app/(site)/css-rule";
import { SiteFooter } from "@/app/(site)/site-footer";
import { WORDMARK_RED } from "@/app/(site)/wordmark";
import { generateGlowCss } from "@/app/_glow/generate-glow-css";

const footer = readCss("site-footer.css");

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

/**
 * Overscroll past the end of the document opens a rubber-band gutter below the
 * footer, and bare canvas there is near-black --surface under a band whose last
 * painted row is opaque red. The skirt fills that gutter with the band's own
 * bottom colour -- without lengthening the page, and without a scrollbar.
 */
describe("the footer's overscroll skirt", () => {
  it("hangs a 1000px block off the bottom edge of the band", () => {
    const body = rule(footer, ".job-footer::after");

    expect(body).toContain("position: absolute");
    expect(body).toContain("inset-block-start: 100%");
    expect(body).toContain("block-size: 1000px");
  });

  // clip, not hidden: hidden would clip the skirt away with the orbs, and
  // visible would hand the document 1000px of scroll with nothing in it.
  it("clips the band so the skirt costs no scroll length", () => {
    const body = rule(footer, ".job-footer");

    expect(body).toContain("overflow: clip");
    expect(body).toContain("overflow-clip-margin: 1000px");
    expect(body).not.toContain("overflow: hidden");
  });

  // 100vw measures the scrollbar gutter too, so on any platform that reserves
  // one it would overhang by exactly that width -- a horizontal scrollbar.
  it("takes its width from the band, never from the viewport", () => {
    const body = rule(footer, ".job-footer::after");

    expect(body).toContain("inset-inline: 0");
    expect(body).not.toContain("vw");
  });

  // The band's clip margin releases every edge, so the glow's own clip is the
  // only thing left holding the orbs inside the band.
  it("leaves the orbs clipped by the glow's own box", () => {
    expect(rule(stripComments(generateGlowCss()), ".glow")).toContain("overflow: hidden");
  });

  // .job-footer__scrim is inset: 0, so the band's last painted row is the wash
  // under 14% black, not #e50914. The skirt mixes the same 14% or it seams.
  it("matches the scrimmed bottom edge rather than the raw accent", () => {
    expect(rule(footer, ".job-footer__scrim")).toContain("rgb(0 0 0 / 0.14)");
    expect(rule(footer, ".job-footer::after")).toContain(
      "color-mix(in srgb, #000 14%, var(--accent))",
    );
  });
});
