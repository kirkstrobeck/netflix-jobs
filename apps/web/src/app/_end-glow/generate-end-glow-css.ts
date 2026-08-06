import { buildEndOrbs } from "@/app/_end-glow/build-end-orbs";
import {
  ORBS_BLUR_PX,
  WASH_BEZIER_X1,
  WASH_BEZIER_X2,
  WASH_BEZIER_Y1,
  WASH_BEZIER_Y2,
} from "@/app/_end-glow/end-glow-math";

function bez1d(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const refine = (t: number, steps: number): number => {
    if (steps <= 0) {
      return t;
    }
    const xEst = bez1d(t, x1, x2);
    const d = (bez1d(t + 1e-6, x1, x2) - xEst) / 1e-6;
    if (Math.abs(d) < 1e-9) {
      return t;
    }
    return refine(t - (xEst - x) / d, steps - 1);
  };
  return bez1d(Math.min(1, Math.max(0, refine(x, 10))), y1, y2);
}

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
  orb: ReturnType<typeof buildEndOrbs>[number],
  i: number,
): string {
  const body = orb.stops
    .map(
      (stop) =>
        `  ${stop.at}% { transform: ${orbTransform(stop.left, stop.bottom)}; opacity: ${stop.opacity}; }`,
    )
    .join("\n");
  return `@keyframes end-orb-${i} {
${body}
}`;
}

export function generateEndGlowCss(): string {
  const orbs = buildEndOrbs();
  const keyframes = orbs.map((orb, i) => orbKeyframes(orb, i)).join("\n");
  const rules = orbs
    .map(
      (orb, i) =>
        `.end-glow__orb--${i} { width: ${orb.width}; height: ${orb.height}%; animation: end-orb-${i} ${orb.duration}s linear ${orb.delay}s infinite alternate; }`,
    )
    .join("\n");

  return `
.end-glow {
  pointer-events: none;
  position: fixed;
  inset: 0;
  overflow: visible;
}
.end-glow__wash {
  position: absolute;
  inset: 0;
  background: ${easedRedWash()};
}
.end-glow__orbs {
  position: absolute;
  inset: 0;
  container-type: size;${ORBS_BLUR_PX > 0 ? `\n  filter: blur(${ORBS_BLUR_PX}px);` : ""}
}
.end-glow__orb {
  position: absolute;
  left: 0;
  bottom: 0;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, #e50914 0%, #e5091488 35%, transparent 72%);
  backface-visibility: hidden;
}
${keyframes}
${rules}
@media (prefers-reduced-motion: reduce) {
  .end-glow__orb { animation: none !important; opacity: 0; }
}
`.trim();
}
