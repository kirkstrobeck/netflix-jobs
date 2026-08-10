import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UltraSurface } from "@/app/_ultra/ultra-surface";
import { ULTRA_BLEED } from "@/lib/ultra/ultra-config";

describe("UltraSurface", () => {
  /**
   * The overlay layers are grown ULTRA_BLEED past the box on every side, so the
   * box itself is the middle of the SVG rather than the whole of it. At a 50%
   * bleed the SVG is 200% and the plate is the middle 50%, a quarter in.
   *
   * Getting this wrong does not fail loudly: the fill simply covers more or less
   * than the button, which is a bright rectangle behind a control.
   */
  it("masks the plate to the middle of the grown viewport", () => {
    const html = renderToStaticMarkup(<UltraSurface radius={3} />);
    const rect = /<rect([^>]*)>/.exec(html)?.[1] ?? "";

    expect(rect).toContain(`x="${ULTRA_BLEED / 2}%"`);
    expect(rect).toContain(`y="${ULTRA_BLEED / 2}%"`);
    expect(rect).toContain(`width="${100 - ULTRA_BLEED}%"`);
    expect(rect).toContain(`height="${100 - ULTRA_BLEED}%"`);
  });

  // A mask with a different corner from the box it covers shows as a bright
  // sliver at each corner, which is why the radius is passed in rather than
  // guessed here.
  it("cuts the mask with the corner it was given", () => {
    expect(renderToStaticMarkup(<UltraSurface radius={3} />)).toContain('rx="3"');
  });

  /**
   * url(#...) is CSS, and a colon in the id makes it an invalid selector -- so
   * the mask silently does not apply and the fill paints as a full rectangle
   * over the button and everything near it. React's useId() contains colons.
   */
  it("gives the mask a css-safe id, and points the canvas at it", () => {
    const html = renderToStaticMarkup(<UltraSurface radius={3} />);
    const id = /<mask id="([^"]+)"/.exec(html)?.[1];

    expect(id).toMatch(/^ultra-surface-[a-zA-Z0-9]+$/);
    expect(html).toContain(`mask:url(#${id})`);
  });

  // Decoration over a control: it must not be read, and it must never be what
  // receives the click meant for the button it sits inside.
  it("is inert", () => {
    const html = renderToStaticMarkup(<UltraSurface radius={3} />);

    expect(html).toContain('<svg aria-hidden="true" class="ultra__mask">');
    expect(html).toContain('<canvas aria-hidden="true" class="ultra-fill ultra__fill"');
  });
});
