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

function easedRedWash(): string {
  const stops = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
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
  return `translate3d(${left}cqw, ${-bottom}cqh, 0) translate(-50%, 0)`;
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
        `.glow__orb--${i} { width: ${orb.width}; height: ${orb.height}%; animation: glow-orb-${i} ${orb.duration}s linear ${orb.delay}s infinite alternate; }`,
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
