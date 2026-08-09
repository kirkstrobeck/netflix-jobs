import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readCss, rule } from "@/app/(site)/css-rule";
import { SiteHeader } from "@/app/(site)/site-header";
import { WORDMARK_RED } from "@/app/(site)/wordmark";

const masthead = readCss("site-masthead.css");

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
