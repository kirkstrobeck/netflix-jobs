import { buildOrbs } from "@/app/_glow/build-orbs";
import { cubicBezier } from "@/app/_glow/cubic-bezier";
import {
  ORBS_BLUR_PX,
  WASH_BEZIER_X1,
  WASH_BEZIER_X2,
  WASH_BEZIER_Y1,
  WASH_BEZIER_Y2,
} from "@/app/_glow/glow-math";
import { PAUSED_CLASS } from "@/app/_motion/pause-when-idle";

/** Stops in the wash gradient. The floor below reads the same number. */
const WASH_STOPS = 49;

function easedRedWash(): string {
  const stops = Array.from({ length: WASH_STOPS }, (_, i) => {
    const t = i / (WASH_STOPS - 1);
    const alpha =
      1 -
      cubicBezier(
        WASH_BEZIER_X1,
        WASH_BEZIER_Y1,
        WASH_BEZIER_X2,
        WASH_BEZIER_Y2,
        t,
      );
    return `rgb(229 9 20 / ${alpha.toFixed(4)}) ${(t * 100).toFixed(2)}%`;
  });
  return `linear-gradient(to top in oklab, ${stops.join(", ")})`;
}

function orbTransform(left: number, bottom: number): string {
  return `translate3d(${left}cqw, ${-bottom}cqh, 0)`;
}

/**
 * The other half of centering an orb on its walk point. Every keyframe stop used
 * to end in a literal `translate(-50%, 0)` -- the same 20 characters repeated
 * across ~12,000 stops, a fifth of the whole stylesheet, saying a constant.
 *
 * A negative margin says it once. The orb is `position: absolute; left: 0` with
 * a definite width and `right: auto`, so its border box starts at
 * `left + margin-left`; half its own width to the left of the walk point is
 * exactly where `translate(-50%, 0)` put it.
 *
 * The percentage case is equivalent for the same reason the transform was: with
 * border-box sizing and no padding or border, `width: 54%` makes the border box
 * 54% of the containing block, and a `margin-left` percentage resolves against
 * that same containing block width -- so -27% is -50% of the box.
 */
function orbCentering(width: string): string {
  const unit = width.endsWith("%") ? "%" : "rem";
  const half = +(Number.parseFloat(width) / 2).toFixed(3);
  return `-${half}${unit}`;
}

function orbKeyframes(
  orb: ReturnType<typeof buildOrbs>[number],
  i: number,
): string {
  const body = orb.stops
    .map(
      (stop) =>
        `  ${stop.at}% { transform: ${orbTransform(stop.left, stop.bottom)}; opacity: ${stop.opacity}; }`,
    )
    .join("\n");
  return `@keyframes glow-orb-${i} {
${body}
}`;
}

export function generateGlowCss(): string {
  const orbs = buildOrbs();
  const keyframes = orbs.map((orb, i) => orbKeyframes(orb, i)).join("\n");
  const rules = orbs
    .map(
      (orb, i) =>
        `.glow__orb--${i} { width: ${orb.width}; height: ${orb.height}%; margin-left: ${orbCentering(orb.width)}; animation: glow-orb-${i} ${orb.duration}s linear ${orb.delay}s infinite alternate; }`,
    )
    .join("\n");

  return `
/* absolute, not fixed: the glow fills its nearest positioned ancestor, so it
   works as a page-sized backdrop AND as the light inside a footer band. It is
   the caller's job to make that ancestor position: relative.

   overflow: hidden is load-bearing, not tidiness. Orbs are up to 3.4x the box
   tall and walk from -18% to 118% across it; unclipped they would spill past a
   band and, in a document flow, lengthen the page with phantom scroll. */
.glow {
  pointer-events: none;
  position: absolute;
  inset: 0;
  overflow: hidden;
}
/* The wash's ground. The wash is a gradient from opaque red to transparent, so
   everywhere above its bottom stop the pixel you actually see is the wash
   composited over WHATEVER IS BEHIND .glow -- the consumer's background, which
   here is near-black --surface. This paints the band's own bottom colour there
   instead, so the ramp lands on red rather than on the host page.

   It is a ::before and not a fourth div because it takes no markup to say. That
   also fixes its paint order for free: a ::before generates as .glow's FIRST
   child, and every layer in here is position: absolute at z-index: auto, so it
   paints below .glow__wash and .glow__orbs in tree order. That is the required
   order, not an accident to be corrected -- this is the ground, and giving it a
   z-index would lift it over the wash and replace the ramp with a flat slab.

   No z-index is also what keeps the rule safe to reuse. .glow is
   position: absolute / z-index: auto, so it is NOT a stacking context: any
   z-index put here would compete inside the CONSUMER's stacking context, and in
   the footer it wins against .job-footer::before -- the scrim would end up
   veiling nothing. At auto it cannot reach out of the glow at all.

   Sized in .glow's own box, so it rescales with the box like everything else
   here: inset-inline: 0 for the band's exact width (never 100vw, which counts
   the scrollbar gutter), inset-block-end: 0 to pin it to the bottom edge, and a
   height of one wash stop -- 100/(WASH_STOPS - 1) percent, the first step of the
   gradient above it. That is the zone the wash itself treats as fully red, which
   is what makes the ground invisible rather than a second colour: measured
   against a 400px band, the last painted row is rgb(195, 3, 13) with this rule
   and without it. Take the height past one stop and the wash goes translucent
   enough to show it, and the bottom of the band reddens.

   The colour is the scrimmed accent, not the raw accent, because the band's last
   row is not #e50914: .job-footer::before lays 0.14 black over the wash right
   down to the bottom edge. Mixing the same 14% in here is what makes the ground
   agree with the row above it. If that scrim's alpha moves, this moves with it.
   The fallback keeps the rule standalone -- --accent is defined on .job-page,
   and .glow is droppable anywhere. */
.glow::before {
  content: "";
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  block-size: ${(100 / (WASH_STOPS - 1)).toFixed(2)}%;
  background: color-mix(in srgb, #000 14%, var(--accent, #e50914));
}
.glow__wash {
  position: absolute;
  inset: 0;
  background: ${easedRedWash()};
}
.glow__orbs {
  position: absolute;
  inset: 0;
  container-type: size;${ORBS_BLUR_PX > 0 ? `\n  filter: blur(${ORBS_BLUR_PX}px);` : ""}
}
.glow__orb {
  position: absolute;
  left: 0;
  bottom: 0;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, #e50914 0%, #e5091488 35%, transparent 72%);
  backface-visibility: hidden;
}
${keyframes}
${rules}
/* Off-screen, or in a background tab. Only the orbs stop -- .glow__wash is a
   static gradient that costs nothing to leave painted, and pausing it would mean
   the footer's red ground vanished as you scrolled away from it. */
.glow.${PAUSED_CLASS} .glow__orb {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .glow__orb { animation: none !important; opacity: 0; }
}
`.trim();
}
