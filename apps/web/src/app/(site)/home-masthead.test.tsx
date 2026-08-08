import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BAR_ALPHA, BAR_COUNT } from "@/app/_bars/bars-tunables";
import { HEADLINE, HomeMasthead } from "@/app/(site)/home-masthead";

const html = () => renderToStaticMarkup(<HomeMasthead />);

// React escapes the apostrophe to &#x27; on the way into the markup; the browser
// decodes it back, so the rendered text is the headline exactly as written.
const decoded = () => html().replaceAll("&#x27;", "'");

describe("HomeMasthead", () => {
  it("renders the headline verbatim, in sentence case, as an h1", () => {
    expect(HEADLINE).toBe("Be part of what's next");
    expect(decoded()).toContain(`<h1 class="masthead__title">${HEADLINE}</h1>`);
  });

  it("has exactly one h1", () => {
    expect(html().match(/<h1/g)).toHaveLength(1);
  });

  // Reused, not reimplemented: the same <BarsStage> the job masthead mounts.
  it("sits on the shared bars stage, with the headline in the content layer", () => {
    const markup = html();

    expect(markup).toContain('<header class="bars-stage masthead">');
    expect(markup).toContain('class="bars"');
    expect(markup).toContain('class="bars-stage__content"');
    expect(markup.indexOf('class="bars"')).toBeLessThan(markup.indexOf("<h1"));
  });
});

// The bars move, so the headline has to hold against the worst frame rather than
// a typical one. The worst frame is bounded by the alpha maths: every bar is the
// same flat alpha, so the darkest a stack can make the backdrop is all of them
// over the same pixel. If a future retune raises the count or the alpha past
// what --ink can sit on, this fails and the backdrop needs a scrim.
describe("headline contrast at the worst frame", () => {
  const channel = (c: number) => {
    const s = c / 255;

    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = ([r, g, b]: number[]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
  };

  const SURFACE = [8, 2, 2];
  const ACCENT = [229, 9, 20];
  const INK = [245, 245, 245];

  it("holds AA with every bar stacked on the same pixel", () => {
    // 1 - (1 - alpha)^n: the composite of n identical translucent layers.
    const ceiling = 1 - Math.pow(1 - BAR_ALPHA, BAR_COUNT);
    const backdrop = ACCENT.map((c, i) => c * ceiling + SURFACE[i] * (1 - ceiling));

    expect(ceiling).toBeCloseTo(0.7941, 4);
    expect(contrast(INK, backdrop)).toBeGreaterThan(4.5);
  });

  // Even against flat, fully opaque accent -- darker than the bars can reach --
  // the headline stays legible at its size. This is the floor under the floor.
  it("still clears AA large text against solid accent", () => {
    expect(contrast(INK, ACCENT)).toBeGreaterThan(3);
  });
});
