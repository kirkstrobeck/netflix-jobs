import {
  buildOrbPath,
  mix,
  type OrbStop,
} from "@/app/foo/end-glow-math";

export const END_ORB_COUNT = 50;

export type EndOrb = {
  width: string;
  height: number;
  duration: number;
  delay: number;
  ease: string;
  stops: OrbStop[];
};

function uniquify(values: number[], digits: number): number[] {
  return values.reduce<number[]>((acc, raw) => {
    const step = 10 ** -digits;
    const fmt = (n: number) => n.toFixed(digits);
    const used = new Set(acc.map(fmt));
    const next = Array.from({ length: 80 }, (_, k) =>
      +(raw + k * step).toFixed(digits),
    ).find((n) => !used.has(fmt(n)));
    return [...acc, next ?? raw];
  }, []);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function easingFor(i: number): string {
  const x1 = +clamp01(0.15 + (i % 11) * 0.05).toFixed(3);
  const y1 = +clamp01(0.05 + ((i * 3) % 9) * 0.08).toFixed(3);
  const x2 = +clamp01(0.55 + ((i * 5) % 8) * 0.04).toFixed(3);
  const y2 = +clamp01(0.75 + ((i * 7) % 6) * 0.04).toFixed(3);
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

function sizeNorm(widthRem: number, widthPct: number, usePct: boolean): number {
  if (usePct) {
    return clamp01((widthPct - 54.42) / (128.31 - 54.42));
  }
  return clamp01((widthRem - 3.401) / (8.618 - 3.401));
}

export function buildEndOrbs(): EndOrb[] {
  const peaks = uniquify(
    Array.from({ length: END_ORB_COUNT }, (_, i) => mix(i, 0.05, 0.5, 11)),
    3,
  );
  // Vertical band: top edge moves within [topMin, topMax], never past 100.
  const topMaxes = uniquify(
    Array.from({ length: END_ORB_COUNT }, (_, i) => {
      if (i % 6 === 0) {
        return 100;
      }
      return mix(i, 55, 100, 15);
    }),
    1,
  ).map((t, i) => (i % 6 === 0 ? 100 : Math.min(100, t)));
  const topMins = topMaxes.map((hi, i) => {
    const span = mix(i, 27, 60, 16);
    return +Math.max(25, hi - span).toFixed(1);
  });
  // Height from the highest top so ≤35% of the sphere is ever visible
  // (the rest hangs below the div). Taller = even less showing.
  const heights = topMaxes.map((hi, i) => {
    const for35 = hi / 0.35;
    return Math.round(mix(i, for35, for35 * 1.2, 1));
  });
  const widthPcts = uniquify(
    Array.from({ length: END_ORB_COUNT }, (_, i) =>
      Math.round(mix(i, 54.42, 128.31, 2)),
    ),
    0,
  );
  const widthRems = uniquify(
    Array.from({ length: END_ORB_COUNT }, (_, i) => mix(i, 3.401, 8.618, 3)),
    2,
  );
  const easings = Array.from({ length: END_ORB_COUNT }, (_, i) =>
    easingFor(i),
  );

  return Array.from({ length: END_ORB_COUNT }, (_, i) => {
    const size = sizeNorm(widthRems[i], widthPcts[i], i % 5 === 0);
    const path = buildOrbPath(
      i,
      size,
      peaks[i],
      heights[i],
      topMins[i],
      topMaxes[i],
    );
    const width =
      i % 5 === 0 ? `${widthPcts[i]}%` : `${widthRems[i].toFixed(2)}rem`;
    return {
      width,
      height: heights[i],
      duration: path.duration,
      delay: +(-mix(i, 0, path.duration, 5)).toFixed(2),
      ease: easings[i],
      stops: path.stops,
    };
  });
}
