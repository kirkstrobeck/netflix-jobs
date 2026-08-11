import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AboutPage from "@/app/(site)/about/page";
import { CLOSING, HEADLINES, SECTIONS } from "@/app/(site)/about/about-copy";

const html = () => renderToStaticMarkup(<AboutPage />);

describe("the about page", () => {
  /**
   * A reader who stops at the top of the page still has the whole argument, so
   * the five claims are the first thing after the headline -- and they are a
   * real <ul>, which is what makes a screen reader say there are five of them
   * before reading the first.
   */
  it("leads with five claims, as a list", () => {
    const markup = html();

    expect(HEADLINES).toHaveLength(5);
    expect(markup).toContain('<ul class="about__stats">');
    expect(markup.match(/<li class="stat">/g)).toHaveLength(5);

    HEADLINES.forEach((item) => {
      expect(markup).toContain(item.stat);
      expect(markup).toContain(item.claim);
    });
  });

  // The five the brief names. Pinned by content rather than by count, so
  // dropping one to make room for a sixth fails here.
  it("makes the five claims that matter", () => {
    const claims = HEADLINES.map((item) => `${item.stat} ${item.claim}`);

    expect(claims).toEqual([
      "100% test coverage",
      "100 Lighthouse on desktop, all five categories",
      "0 migration required",
      "480 roles, crawled on one command",
      "1 cache entry per URL",
    ]);
  });

  /**
   * One h1, then h2 per section, in document order. A page whose headings skip
   * a level reads as a flat list of shouting to anyone navigating by heading,
   * and this page is mostly headings.
   */
  it("has one h1 and an h2 for every section", () => {
    const markup = html();

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup.match(/<h2/g)).toHaveLength(SECTIONS.length + 1);
    expect(markup).not.toContain("<h3");
  });

  // Every section is labelled by its own heading, so the landmark a screen
  // reader announces carries the same words the eye reads.
  it("labels each section with the heading inside it", () => {
    const markup = html();

    SECTIONS.forEach((section) => {
      expect(markup).toContain(`aria-labelledby="${section.id}"`);
      expect(markup).toContain(`id="${section.id}"`);
      expect(markup).toContain(section.heading);
    });
  });

  it("keeps the closing note", () => {
    expect(html()).toContain(CLOSING);
    expect(CLOSING).toContain("lead a team");
  });

  // The site's own masthead and Ultra headline, not a second treatment invented
  // for one page.
  it("wears the site's masthead", () => {
    const markup = html();

    expect(markup).toContain('<header class="bars-stage masthead">');
    expect(markup).toContain('<h1 class="ultra masthead__title">');
  });
});

describe("the copy", () => {
  /**
   * The rules this page is written to. Sentence case headings, and none of the
   * words that read as marketing rather than as a measurement.
   */
  it("sets every heading in sentence case", () => {
    SECTIONS.forEach((section) => {
      const words = section.heading.split(" ").slice(1);
      const capitalised = words.filter((word) => /^[A-Z]/.test(word));

      // Proper nouns are the only capitals allowed after the first word.
      expect(capitalised.every((word) => /^(CSS|SVG|URL|HTML|Ultra|Netflix)/.test(word))).toBe(
        true,
      );
    });
  });

  it("uses none of the words that oversell", () => {
    const prose = [
      ...HEADLINES.map((item) => item.detail),
      ...SECTIONS.flatMap((section) => section.body),
      CLOSING,
    ].join(" ");

    ["easy", "simple", "quick", "very", "really", "seamless", "powerful"].forEach(
      (word) => expect(prose.toLowerCase()).not.toContain(` ${word} `),
    );
  });
});
