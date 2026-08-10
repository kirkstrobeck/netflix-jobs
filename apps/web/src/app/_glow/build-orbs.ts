import {
  buildWalk,
  HEIGHT_EXTRA_MAX,
  mix,
  OPACITY_MAX,
  OPACITY_MIN,
  ORB_COUNT,
  TOP_CEILING,
  TOP_FLOOR,
  TOP_FLUSH_EVERY_N,
  TOP_MAX_MIX_MIN,
  VISIBLE_SPHERE_MAX,
  WIDTH_PCT_MAX,
  WIDTH_PCT_MIN,
  WIDTH_REM_MAX,
  WIDTH_REM_MIN,
  LOOP_X_MAX_S,
  LOOP_X_MIN_S,
  LOOP_Y_MAX_S,
  LOOP_Y_MIN_S,
  TRAVEL_X_MAX,
  TRAVEL_X_MIN,
  TRAVEL_Y_MAX,
  TRAVEL_Y_MIN,
  WALK_X_MAX,
  WALK_X_MIN,
  Y_SPAN_MAX,
  Y_SPAN_MIN,
  type Walk,
} from "@/app/_glow/glow-math";
import { uniquify } from "@/app/_glow/uniquify";

/**
 * One orb: a size, and the two loops its drift is the sum of.
 *
 * `x` is written on .glow__orb and `y` on its ::before, so the browser
 * multiplies the two transforms rather than the generator adding them into one
 * list of stops. Each carries its own duration and its own negative delay, and
 * neither has to be a whole number of the other.
 */
export type Track = Walk & { delay: number };

export type Orb = {
  width: string;
  height: number;
  ease: string;
  x: Track;
  y: Track;
};

export function clamp01(n: number): number {
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

export function buildOrbs(): Orb[] {
  const peaks = uniquify(
    Array.from({ length: ORB_COUNT }, (_, i) =>
      mix(i, OPACITY_MIN, OPACITY_MAX, 11),
    ),
    3,
  );
  // Every TOP_FLUSH_EVERY_N-th orb rides the ceiling; the rest mix up to it.
  // The ceiling is TOP_CEILING, not 100 -- see the note on the constant.
  const topMaxes = uniquify(
    Array.from({ length: ORB_COUNT }, (_, i) => {
      if (i % TOP_FLUSH_EVERY_N === 0) {
        return TOP_CEILING;
      }
      return mix(i, TOP_MAX_MIX_MIN, TOP_CEILING, 15);
    }),
    1,
  ).map((t, i) =>
    i % TOP_FLUSH_EVERY_N === 0 ? TOP_CEILING : Math.min(TOP_CEILING, t),
  );
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
    const common = { seed: i, size };
    const x = buildWalk({
      ...common,
      axis: 0,
      lo: WALK_X_MIN,
      hi: WALK_X_MAX,
      travelMin: TRAVEL_X_MIN,
      travelMax: TRAVEL_X_MAX,
      target: mix(i, LOOP_X_MIN_S, LOOP_X_MAX_S, 4),
      peak: peaks[i],
    });
    // The Y walk is built in top edges and stored as the box's BOTTOM edge, the
    // way the keyframe has to say it: the orb sits at bottom: 0 and is
    // `height` tall, so putting its top edge at t means pushing the box down by
    // height - t. Subtracting here keeps that arithmetic in one place.
    const y = buildWalk({
      ...common,
      axis: 1,
      lo: topMins[i],
      hi: topMaxes[i],
      travelMin: TRAVEL_Y_MIN,
      travelMax: TRAVEL_Y_MAX,
      target: mix(i, LOOP_Y_MIN_S, LOOP_Y_MAX_S, 9),
    });
    const width =
      i % 5 === 0 ? `${widthPcts[i]}%` : `${widthRems[i].toFixed(2)}rem`;

    return {
      width,
      height: heights[i],
      ease: easings[i],
      x: { ...x, delay: +(-mix(i, 0, x.duration, 5)).toFixed(2) },
      y: {
        ...y,
        delay: +(-mix(i, 0, y.duration, 8)).toFixed(2),
        stops: y.stops.map((stop) => ({
          ...stop,
          value: +(stop.value - heights[i]).toFixed(2),
        })),
      },
    };
  });
}
