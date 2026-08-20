import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { keyframeProperties, readCss, rule } from "@/app/(site)/css-rule";
import { SiteHeader } from "@/app/(site)/site-header";
import { WORDMARK_RED } from "@/app/(site)/wordmark";

const masthead = readCss("site-masthead.css");
const scroll = readCss("site-masthead-scroll.css");

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

  it("renders an About nav link to /about", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('aria-label="Site navigation"');
    expect(html).toContain('href="/about"');
    expect(html).toContain("About this project");
  });
});

/**
 * The wordmark is 23.4px of artwork centred in a 72px bar, and the whole bar
 * should answer a click on it. An overlay inside the anchor grows the target
 * without growing the anchor's own box -- which is what .job-page
 * :focus-visible outlines, and so what a stretched anchor would visibly change.
 */
describe("the masthead wordmark's hit area", () => {
  it("covers the bar with an overlay inside the link", () => {
    const body = rule(masthead, ".site-header .wordmark::after");

    expect(rule(masthead, ".site-header .wordmark")).toContain("position: relative");
    expect(body).toContain('content: ""');
    expect(body).toContain("position: absolute");
    expect(body).toContain("transform: translateY(-50%)");
  });

  // The overlay's height and the bar's height are the same number written
  // twice, so this is the test that keeps them the same number.
  it("is exactly as tall as the bar it has to fill", () => {
    const bar = /min-block-size: (\S+);/.exec(rule(masthead, ".site-header__inner"));

    expect(bar?.[1]).toBe("4.5rem");
    expect(rule(masthead, ".site-header .wordmark::after")).toContain(
      `block-size: ${bar?.[1]}`,
    );
  });

  // Only the height grows. The bar is a .shell, so an inline stretch would hand
  // the whole 76rem row to the logo link.
  it("grows the target vertically and leaves the anchor's box alone", () => {
    expect(rule(masthead, ".site-header .wordmark::after")).toContain("inset-inline: 0");
    expect(masthead).not.toContain("align-self: stretch");
    expect(rule(masthead, ".site-header .wordmark")).not.toContain("block-size");
  });
});

/**
 * The header shrank by animating min-block-size and block-size on a scroll
 * timeline: layout properties on a sticky, in-flow element, so every scrolled
 * frame re-laid-out the document below it. It shipped anyway, because the
 * comment above the rule asserted it was compositor work and nothing checked.
 *
 * This is that check, and it is deliberately an assertion about the PROPERTIES
 * rather than about the prose. A comment can be wrong; a property list cannot.
 * Both masthead sheets are read, so moving a keyframe back into the resting one
 * does not slip past.
 */
describe("what the masthead animates as the page scrolls", () => {
  // transform is here because it is compositable, not because this file uses
  // it -- the scroll block deliberately uses translate and scale so that
  // .site-header .wordmark::after keeps sole ownership of transform.
  const COMPOSITOR_ONLY = ["translate", "scale", "rotate", "transform", "opacity"];

  it("animates nothing that costs a layout", () => {
    const animated = keyframeProperties(`${masthead}\n${scroll}`);

    // Guards the assertion below against a stylesheet this stopped finding
    // keyframes in, which would otherwise pass by being empty.
    expect(animated.length).toBeGreaterThan(0);
    expect(animated.filter((property) => !COMPOSITOR_ONLY.includes(property))).toEqual(
      [],
    );
  });

  // The band closes because the header is painted higher, not because anything
  // resizes. If the box ever starts moving again, these two are how it shows.
  it("leaves the header row's own box at its resting height", () => {
    expect(rule(masthead, ".site-header__inner")).toContain("min-block-size: 4.5rem");
    expect(scroll).not.toContain("min-block-size");
  });

  // The shorthand resets animation-timeline, so a timeline declared before it is
  // silently discarded -- the trap globals.css records.
  it("declares each timeline after the shorthand that would reset it", () => {
    for (const selector of [
      ".site-header",
      ".site-header__inner",
      ".site-header .wordmark__mark",
      ".site-header .wordmark__suffix",
    ]) {
      const body = rule(scroll, selector);

      expect(body.indexOf("animation-timeline")).toBeGreaterThan(
        body.indexOf("animation:"),
      );
    }
  });
});
