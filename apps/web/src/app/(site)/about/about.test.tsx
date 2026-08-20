import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AboutPage from "@/app/(site)/about/page";
import {
  GIFT,
  GROUPS,
  HEADLINE,
  HEADLINES,
  LINKEDIN,
  SIGNATURE,
  TITLE,
} from "@/app/(site)/about/about-copy";

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
      "100 Lighthouse on mobile, four of five categories",
      "60.2 fps on the animated masthead",
      "112 tab stops, all with a visible focus state",
      "1 cache entry per URL",
    ]);
  });

  /**
   * One h1, then h2 per section, in document order. A page whose headings skip
   * a level reads as a flat list of shouting to anyone navigating by heading,
   * and this page is mostly headings.
   */
  it("has one h1 and an h2 for every group", () => {
    const markup = html();

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup.match(/<h2/g)).toHaveLength(GROUPS.length);
    expect(markup).not.toContain("<h3");
  });

  // Every section is labelled by its own heading, so the landmark a screen
  // reader announces carries the same words the eye reads.
  it("labels each group with the heading inside it", () => {
    const markup = html();

    GROUPS.forEach((group) => {
      expect(markup).toContain(`aria-labelledby="${group.id}"`);
      expect(markup).toContain(`id="${group.id}"`);
      expect(markup).toContain(group.heading);
    });
  });

  /**
   * A catalogue, not an article. Every group is a list of one-line points, and
   * the only paragraphs on the page are the five stat details and the last two
   * lines -- so a reader who stops after any group has read whole facts.
   */
  it("states every group as a list, one point per item", () => {
    const markup = html();
    const points = GROUPS.reduce((total, group) => total + group.points.length, 0);

    expect(markup.match(/<ul class="about__list">/g)).toHaveLength(GROUPS.length);
    expect(markup.match(/<li class="about__point">/g)).toHaveLength(points);
  });

  it("carries no narrative opener", () => {
    const markup = html();

    expect(markup).not.toContain("about__lede");
    expect(markup).not.toContain("Built to be read");
    expect(markup).not.toContain("Here is what that is worth");
  });

  // No first person anywhere on the page. Every line is a measurement or a
  // statement about the project, including the gift.
  it("never speaks in the first person", () => {
    const prose = [
      ...HEADLINES.map((item) => item.detail),
      ...GROUPS.flatMap((group) => group.points),
      GIFT,
    ].join(" ");

    expect(/\bI\b|\bmy\b|\bwe\b/i.test(prose)).toBe(false);
  });

  /**
   * THE TITLE IS THE BAND'S HEADING, AT DISPLAY SIZE.
   *
   * It was on .masthead__title -- a class in home-masthead.css, which only the
   * listing imports -- so on this page the h1 had no rules and rendered at 16px
   * inside a 24px band. Measured in Chromium. The band and the title are this
   * page's own now, both in about.css.
   */
  it("puts the title in the band, at its own display size", () => {
    const markup = html();

    expect(markup).toContain('<header class="bars-stage about-masthead">');
    expect(markup).toContain('<h1 class="ultra about__title">');
    expect(markup).not.toContain("masthead__title");
    expect(markup).toContain(HEADLINE);
  });

  // The page is about a project. "This board" is Netflix's careers board and
  // never this site.
  it("calls itself a project", () => {
    expect(TITLE).toBe("About this project");

    const prose = [
      ...HEADLINES.map((item) => item.detail),
      ...GROUPS.flatMap((group) => group.points),
    ].join(" ");

    expect(prose).not.toContain("this board");
    expect(prose).not.toContain("the site ");
  });

  /**
   * The last two lines, and the only place a name appears. The LinkedIn address
   * was resolved from the 302 the personal domain answers with, on the apex and
   * on www, rather than assumed from the name.
   */
  it("closes with the gift, the signature and the link", () => {
    const markup = html();

    expect(markup).toContain(GIFT);
    expect(GIFT).toContain("gift to Netflix");
    expect(markup).toContain(SIGNATURE);
    expect(SIGNATURE).toBe("Kirk Strobeck");
    expect(markup).toContain(`href="${LINKEDIN.href}"`);
    expect(LINKEDIN.href).toBe("https://www.linkedin.com/in/kirkstrobeck/");
  });
});

describe("the copy", () => {
  /**
   * The rules this page is written to. Sentence case headings, and none of the
   * words that read as marketing rather than as a measurement.
   */
  it("sets every heading in sentence case", () => {
    GROUPS.forEach((group) => {
      const words = group.heading.split(" ").slice(1);
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
      ...GROUPS.flatMap((group) => group.points),
      GIFT,
    ].join(" ");

    ["easy", "simple", "quick", "very", "really", "seamless", "powerful"].forEach(
      (word) => expect(prose.toLowerCase()).not.toContain(` ${word} `),
    );
  });
});
