import { buildEndOrbs } from "@/app/foo/build-end-orbs";
import { cubicBezier } from "@/app/foo/end-glow-math";

function easedRedWash(): string {
  // Full-height wash only — redness via easing, never size or plateaus.
  // Monotonic: full red at the bottom → transparent at the top.
  // Quicker early rise pulls redness down ~20% without a band.
  const x1 = 0.12;
  const y1 = 0.72;
  const x2 = 0.22;
  const y2 = 1;
  const stops = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    const alpha = 1 - cubicBezier(x1, y1, x2, y2, t);
    return `rgb(229 9 20 / ${alpha.toFixed(4)}) ${(t * 100).toFixed(2)}%`;
  });
  return `linear-gradient(to top in oklab, ${stops.join(", ")})`;
}

function orbKeyframes(
  orb: ReturnType<typeof buildEndOrbs>[number],
  i: number,
): string {
  const body = orb.stops
    .map(
      (stop) =>
        `  ${stop.at}% { left: ${stop.left}%; bottom: ${stop.bottom}%; opacity: ${stop.opacity}; }`,
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
.end-glow__orb {
  position: absolute;
  left: 0;
  translate: -50% 0;
  border-radius: 50%;
  filter: blur(10px);
  background: radial-gradient(ellipse at center, #e50914 0%, #e5091488 35%, transparent 72%);
}
${keyframes}
${rules}
@media (prefers-reduced-motion: reduce) {
  .end-glow__orb { animation: none !important; opacity: 0; }
}
`.trim();
}
