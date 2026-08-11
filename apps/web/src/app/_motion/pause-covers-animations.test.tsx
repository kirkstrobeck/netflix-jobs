import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { stripComments } from "@/app/(site)/css-rule";
import { Bars } from "@/app/_bars/bars";
import { generateBarsCss } from "@/app/_bars/generate-bars-css";
import { Glow } from "@/app/_glow/glow";
import { generateGlowCss } from "@/app/_glow/generate-glow-css";
import { PAUSED_CLASS } from "@/app/_motion/pause-when-idle";

/**
 * THE JOINT BETWEEN AN ANIMATION AND ITS PAUSE, WHICH NOTHING ELSE HOLDS.
 *
 * Both effects are animated in one place and paused in another. The bars are
 * animated on `.bars__mover--N` and paused on `.bars__mover`; the orbs are
 * animated on `.glow__orb--N` and its ::before, and paused on `.glow__orb` and
 * its ::before. The two are only connected by both selectors happening to match
 * the same element, and generate-bars-css.ts records in a comment that they had
 * already drifted apart once.
 *
 * Every existing test still passes if an animation is moved to a selector the
 * pause rule does not match. The effect simply runs forever, off screen, and the
 * only symptom is a battery. So this asserts the covering directly: generate
 * both stylesheets, then for every element the effects actually render, if any
 * rule animates it, some rule under the paused class must reach it too.
 *
 * It is done against the rendered DOM rather than by comparing selector strings,
 * because that is the only place the two selectors meet. `.bars__mover--0` is
 * covered by `.bars.is-idle .bars__mover` because of what the markup puts on
 * that div, and no amount of reading the CSS can tell you so.
 */

// Innermost blocks, the same shape css-rule.ts uses. Keyframe stops fall out on
// their own: they declare `translate` and `opacity`, never `animation`.
const BLOCK = /([^{}]+)\{([^{}]*)\}/g;

// `animation:` or `animation-name:`, but not `animation-play-state:`, and not
// the reduced-motion block's `animation: none` -- that is a different mechanism
// with a different job, and it takes the animation away rather than parking it.
const ANIMATES = /(?:^|;|\s)animation(?:-name)?\s*:\s*(?!none)/;
const PAUSES = /animation-play-state\s*:\s*paused/;

type Target = { base: string; pseudo: string };

// Comments first, or a rule's prose joins the selector in front of it -- and
// these two sheets carry more prose than declarations.
function selectors(sheet: string, wanted: RegExp): Target[] {
  const css = stripComments(sheet);

  return [...css.matchAll(BLOCK)]
    .filter((block) => wanted.test(block[2]))
    .flatMap((block) => block[1].split(","))
    .map((selector) => selector.trim())
    .map((selector) => ({
      base: selector.replace(/::[\w-]+$/, ""),
      pseudo: (/::[\w-]+$/.exec(selector) ?? [""])[0],
    }));
}

// The effect's own markup, with the paused class on its root -- which is exactly
// what pause-when-idle.ts puts there when the region leaves the screen.
function idleRegion(markup: string): Element[] {
  const host = document.createElement("div");

  host.innerHTML = markup;
  const root = host.firstElementChild as HTMLElement;
  root.classList.add(PAUSED_CLASS);

  return [root, ...root.querySelectorAll("*")];
}

function uncovered(css: string, markup: string): string[] {
  const animated = selectors(css, ANIMATES);
  const paused = selectors(css, PAUSES);
  const reaches = (targets: Target[], element: Element, pseudo: string) =>
    targets.some((target) => target.pseudo === pseudo && element.matches(target.base));

  return idleRegion(markup).flatMap((element) =>
    ["", "::before", "::after"]
      .filter(
        (pseudo) =>
          reaches(animated, element, pseudo) && !reaches(paused, element, pseudo),
      )
      .map((pseudo) => `${element.className}${pseudo}`),
  );
}

// Guards every assertion below against a parse that stopped finding anything,
// which would otherwise pass by covering an empty set.
function animatedCount(css: string, markup: string): number {
  const animated = selectors(css, ANIMATES);

  return idleRegion(markup).filter((element) =>
    animated.some((target) => element.matches(target.base)),
  ).length;
}

describe("the pause rule covers every animation it is supposed to stop", () => {
  it("reaches every animated element the bars render", () => {
    const css = generateBarsCss();
    const markup = renderToStaticMarkup(<Bars />);

    expect(animatedCount(css, markup)).toBeGreaterThan(0);
    expect(uncovered(css, markup)).toEqual([]);
  });

  it("reaches every animated element the glow renders", () => {
    const css = generateGlowCss();
    const markup = renderToStaticMarkup(<Glow />);

    expect(animatedCount(css, markup)).toBeGreaterThan(0);
    expect(uncovered(css, markup)).toEqual([]);
  });

  /**
   * The test's own teeth. Moving an animation up to the shell -- the exact shape
   * of the drift the comment in generate-bars-css.ts records -- has to be caught,
   * because `.bars.is-idle .bars__mover` does not reach `.bars__bar--0`.
   */
  it("fails when an animation moves out from under the pause selector", () => {
    const drifted = generateBarsCss().replace(
      ".bars__mover--0 { animation:",
      ".bars__bar--0 { animation:",
    );

    expect(uncovered(drifted, renderToStaticMarkup(<Bars />))).toContain(
      "bars__bar bars__bar--0",
    );
  });
});
