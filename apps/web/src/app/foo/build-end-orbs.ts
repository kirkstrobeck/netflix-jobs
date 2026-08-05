import {
  buildOrbPath,
  HEIGHT_EXTRA_MAX,
  mix,
  OPACITY_MAX,
  OPACITY_MIN,
  ORB_COUNT,
  TOP_FLOOR,
  TOP_FLUSH_EVERY_N,
  TOP_MAX_MIX_MIN,
  VISIBLE_SPHERE_MAX,
  WIDTH_PCT_MAX,
  WIDTH_PCT_MIN,
  WIDTH_REM_MAX,
  WIDTH_REM_MIN,
  Y_SPAN_MAX,
  Y_SPAN_MIN,
  type OrbStop,
} from "@/app/foo/end-glow-math";

export const END_ORB_COUNT = ORB_COUNT;

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
    return clamp01((widthPct - WIDTH_PCT_MIN) / (WIDTH_PCT_MAX - WIDTH_PCT_MIN));
  }
  return clamp01((widthRem - WIDTH_REM_MIN) / (WIDTH_REM_MAX - WIDTH_REM_MIN));
}

export function buildEndOrbs(): EndOrb[] {
  const peaks = uniquify(
    Array.from({ length: ORB_COUNT }, (_, i) =>
      mix(i, OPACITY_MIN, OPACITY_MAX, 11),
    ),
    3,
  );
  const topMaxes = uniquify(
    Array.from({ length: ORB_COUNT }, (_, i) => {
      if (i % TOP_FLUSH_EVERY_N === 0) {
        return 100;
      }
      return mix(i, TOP_MAX_MIX_MIN, 100, 15);
    }),
    1,
  ).map((t, i) => (i % TOP_FLUSH_EVERY_N === 0 ? 100 : Math.min(100, t)));
  const topMins = topMaxes.map((hi, i) => {
    const span = mix(i, Y_SPAN_MIN, Y_SPAN_MAX, 16);
    return +Math.max(TOP_FLOOR, hi - span).toFixed(1);
  });
  const heights = topMaxes.map((hi, i) => {
    const forCap = hi / VISIBLE_SPHERE_MAX;
    return Math.round(mix(i, forCap, forCap * HEIGHT_EXTRA_MAX, 1));
  });
  const widthPcts = uniquify(
    Array.from({ length: ORB_COUNT }, (_, i) =>
      Math.round(mix(i, WIDTH_PCT_MIN, WIDTH_PCT_MAX, 2)),
    ),
    0,
  );
  const widthRems = uniquify(
    Array.from({ length: ORB_COUNT }, (_, i) =>
      mix(i, WIDTH_REM_MIN, WIDTH_REM_MAX, 3),
    ),
    2,
  );
  const easings = Array.from({ length: ORB_COUNT }, (_, i) => easingFor(i));

  return Array.from({ length: ORB_COUNT }, (_, i) => {
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
