import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BarsStage } from "@/app/_bars/bars-stage";
import { generateBarsCss } from "@/app/_bars/generate-bars-css";
import { PAUSED_CLASS } from "@/app/_motion/pause-when-idle";

describe("BarsStage", () => {
  it("wraps the bars and the content in one positioned box", () => {
    const html = renderToStaticMarkup(<BarsStage>hello</BarsStage>);

    expect(html).toContain('<div class="bars-stage">');
    expect(html).toContain('class="bars"');
    expect(html).toContain('<div class="bars-stage__content">hello</div>');
  });

  it("renders as the caller's element and keeps the caller's class", () => {
    const html = renderToStaticMarkup(
      <BarsStage as="header" className="job-hero" />,
    );

    expect(html).toContain('<header class="bars-stage job-hero">');
  });

  // <Bars /> is absolute/inset: 0, so without a positioned stage it would
  // escape to whatever ancestor happens to be positioned.
  it("positions the stage and lifts the content over the backdrop", () => {
    const css = generateBarsCss();

    expect(css).toContain(".bars-stage {\n  position: relative;\n}");
    expect(css).toContain("z-index: 1");
  });

  // play-state, not animation: none -- a resumed bar carries on from where it
  // stopped instead of snapping back and replaying its entrance. Both halves of
  // the bar have to stop, or an off-screen region keeps compositing its walk.
  it("pauses both the fade and the walk while the region is idle", () => {
    const css = generateBarsCss();

    expect(css).toContain(
      `.bars.${PAUSED_CLASS} .bars__bar,\n.bars.${PAUSED_CLASS} .bars__mover {\n  animation-play-state: paused;\n}`,
    );
    expect(css).not.toContain(`.bars.${PAUSED_CLASS} .bars__layer`);
  });
});
