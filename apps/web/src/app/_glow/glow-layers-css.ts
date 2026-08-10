import { cubicBezier } from "@/app/_glow/cubic-bezier";
import {
  ORBS_BLUR_PX,
  WASH_BEZIER_X1,
  WASH_BEZIER_X2,
  WASH_BEZIER_Y1,
  WASH_BEZIER_Y2,
} from "@/app/_glow/glow-math";
import { PAUSED_CLASS } from "@/app/_motion/pause-when-idle";

/**
 * Every rule in the glow that is the same for all hundred orbs.
 *
 * Its own file because it is the only part of the sheet a person reads. The
 * boxes, the ramp and the two states are argued here at length; what generate-
 * glow-css.ts does is turn a hundred walks into keyframes, and a hundred walks
 * have nothing to say. Between them they were one file of 233 lines.
 */

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

/** The static layers, down to the empty frame each orb's light sits in. */
export function glowLayersCss(): string {
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
/* The orb is TWO boxes, and only the inner one is visible.

   .glow__orb is a full-size invisible frame that carries the sideways walk and
   the flame; the ::before inside it is the light, and carries the walk up and
   down. Transforms multiply down the tree, so the blob's position is the sum of
   two loops that repeat on different schedules -- which is what keeps this file
   at a fifth of the size it reaches when one keyframe list has to spell out
   both. The reasoning, and the numbers, are in glow-tunables.ts.

   A pseudo-element rather than a second div, so the markup does not double. It
   costs nothing to say here and every orb is one element in the document, the
   same as before -- and the document is the one copy of this that ships
   uncacheable on every request.

   inset: 0 on the frame is what keeps the inner box's percentages meaning what
   they meant when they were on the orb itself: its width and its centering
   margin resolve against the frame, and the frame is the band. */
.glow__orb {
  position: absolute;
  inset: 0;
}
.glow__orb::before {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, #e50914 0%, #e5091488 35%, transparent 72%);
  backface-visibility: hidden;
}`;
}

/** The two states the orbs have that are not a walk. */
export function glowMotionCss(): string {
  return `
/* Off-screen, or in a background tab. Both tracks, or the blob would keep
   climbing inside a frame that had stopped. Only the orbs stop -- .glow__wash is
   a static gradient that costs nothing to leave painted, and pausing it would
   mean the footer's red ground vanished as you scrolled away from it. */
.glow.${PAUSED_CLASS} .glow__orb,
.glow.${PAUSED_CLASS} .glow__orb::before {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .glow__orb { animation: none !important; opacity: 0; }
  .glow__orb::before { animation: none !important; }
}`;
}
