import { readFileSync } from "node:fs";
import { join } from "node:path";

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
 * The band's bottom edge. The red is .glow::before -- the wash's ground, inside
 * the glow's own box -- and it is nowhere else. Not on the footer, which used to
 * own it as a ::after skirt, and above all not on the root: a root background is
 * propagated to the canvas, and the canvas paints the rubber-band gutter at BOTH
 * ends of the document, so the top overscroll would go red too.
 *
 * Nothing inside the document can reach that gutter, and the price of trying was
 * measured: with a 1000px clip margin releasing the skirt, the home page's
 * documentElement.scrollHeight was 3707 against content ending at 2707. Sized in
 * the glow's box instead, the ground costs nothing -- measured again, the home
 * page's scrollHeight is 2707 against a footer whose rect bottom is 2707.
 */
const glow = stripComments(generateGlowCss());

describe("the band's bottom edge", () => {
  it("pins the ground to the bottom of the glow, in the glow's own box", () => {
    const body = rule(glow, ".glow::before");

    expect(body).toContain("position: absolute");
    expect(body).toContain("inset-block-end: 0");
    expect(body).toContain("block-size: 2.08%");
  });

  // Whatever .glow::before does applies everywhere <Glow /> is mounted, so the
  // footer may not be named in it and it may not carry a z-index: .glow is
  // z-index: auto and so not a stacking context, which means any z-index here
  // would compete inside the CONSUMER's stacking context -- and it would beat
  // .job-footer::before, leaving the scrim veiling nothing.
  it("stays a reusable rule: no z-index, no footer in the selector", () => {
    const body = rule(glow, ".glow::before");

    expect(body).not.toContain("z-index");
    expect(glow).not.toContain("job-footer");
  });

  // The skirt is gone from the footer entirely -- not moved, not scoped down.
  it("leaves no red on the footer itself", () => {
    expect(footer).not.toContain(".job-footer::after");
    expect(footer).not.toContain("color-mix");
  });

  // Nothing RESTING on html or body -- a root background is propagated to the
  // canvas, and the canvas is both gutters, not just the low one. This read
  // "globals.css contains no color-mix", which was never about the function: it
  // was a proxy for "no red reaches the root", back when the mix was the only
  // way this codebase spelled the band's red. The end-of-page gutter rule now
  // spells it that way on purpose, so the proxy has to become the thing it stood
  // for -- the red exists in exactly one place, the keyframe that step-end holds
  // off until scroll progress 100%, which is the low gutter and nothing else.
  // The declarations that paint at rest, and the frame the top gutter reads at
  // progress 0%, are still flat black.
  it("leaves the root and the body black, and lets red in only at the page's end", () => {
    const globals = stripComments(
      readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"),
    );
    const RED = "color-mix(in srgb, #000 14%, #e50914)";

    expect(rule(globals, "html, body")).toContain("background: #000000");
    expect(rule(globals, "html, body")).not.toContain("color-mix");
    expect(globals.match(/color-mix/g)?.length).toBe(1);
    expect(rule(globals, "to")).toContain(`background-color: ${RED}`);
    expect(rule(globals, "from")).toContain("background-color: #000000");
    expect(rule(globals, "html")).toContain("animation: page-end-gutter step-end");
  });

  // clip, not hidden: hidden would make the band a scroll container. And no clip
  // margin -- extending the clip rect extends the scrollable overflow with it,
  // which is exactly the 1000px of empty page this used to cost.
  it("clips the band without a clip margin, so the band costs no scroll length", () => {
    const body = rule(footer, ".job-footer");

    expect(body).toContain("overflow: clip");
    expect(body).not.toContain("overflow-clip-margin");
    expect(body).not.toContain("overflow: hidden");
  });

  // 100vw measures the scrollbar gutter too, so on any platform that reserves
  // one the ground would overhang by exactly that width -- a horizontal scrollbar.
  it("takes its width from the glow, never from the viewport", () => {
    const body = rule(glow, ".glow::before");

    expect(body).toContain("inset-inline: 0");
    expect(body).not.toContain("vw");
  });

  // The band's clip is the outer of two; this is the one holding the orbs.
  it("leaves the orbs clipped by the glow's own box", () => {
    expect(rule(glow, ".glow")).toContain("overflow: hidden");
  });

  // The scrim ::before is inset: 0, so the band's last painted row is the wash
  // under 14% black, not #e50914. The ground mixes the same 14% or it seams.
  it("matches the scrimmed bottom edge rather than the raw accent", () => {
    expect(rule(footer, ".job-footer::before")).toContain("rgb(0 0 0 / 0.14)");
    expect(rule(glow, ".glow::before")).toContain(
      "color-mix(in srgb, #000 14%, var(--accent, #e50914))",
    );
  });
});
