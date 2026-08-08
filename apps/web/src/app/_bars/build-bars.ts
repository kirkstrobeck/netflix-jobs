import {
  BAR_COUNT,
  FADE_IN_MAX_S,
  FADE_IN_MIN_S,
  FLIP_ODDS_X_MAX,
  FLIP_ODDS_X_MIN,
  HOP_DURATION_FAST_S,
  HOP_DURATION_FLOOR_S,
  HOP_DURATION_SLOW_S,
  LOOP_DURATION_MAX_S,
  LOOP_DURATION_MIN_S,
  TRAVEL_X_MAX,
  TRAVEL_X_MIN,
  WALK_X_MAX,
  WALK_X_MIN,
  WIDTH_PCT_MAX,
  WIDTH_PCT_MIN,
} from "@/app/_bars/bars-tunables";
// mix and uniquify are input-free number helpers with no glow semantics in
// them, so they are shared rather than copied. The walk below is a port of
// glow's X path, not a call into it.
import { mix } from "@/app/_glow/glow-math";
import { uniquify } from "@/app/_glow/uniquify";

export type BarStop = { at: number; x: number };

export type Bar = {
  width: number;
  duration: number;
  delay: number;
  fadeDelay: number;
  fadeDuration: number;
  stops: BarStop[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// Hop length is driven by how far the hop travels and how wide the bar is:
// wide bars run nearer FAST, narrow ones nearer SLOW, so the field never falls
// into one shared tempo. The floor stops a very short hop becoming a snap.
function hopDuration(i: number, size: number, travel: number): number {
  const s = clamp(size, 0, 1);
  const base =
    HOP_DURATION_FAST_S + (1 - s) * (HOP_DURATION_SLOW_S - HOP_DURATION_FAST_S);
  return Math.max(
    HOP_DURATION_FLOOR_S,
    base * mix(i, 0.92, 1.08, 4) * (travel / 100),
  );
}

function nextDir(i: number, leg: number, prev: 1 | -1): 1 | -1 {
  const flip = mix(i * 31, FLIP_ODDS_X_MIN, FLIP_ODDS_X_MAX, 40 + (leg % 11));
  if (mix(i * 97 + leg * 53, 0, 1, 100 + leg) < flip) {
    return prev === 1 ? -1 : 1;
  }
  return prev;
}

// Clamped, not merely reversed. From a position near one edge, `from - dir *
// travel` can overshoot the OTHER edge, and once a walk is outside its band
// every later hop is out of range too, so a bare reversal keeps pushing it
// further out instead of pulling it back.
function nudge(
  from: number,
  dir: 1 | -1,
  travel: number,
): { to: number; dir: 1 | -1 } {
  const raw = from + dir * travel;
  if (raw >= WALK_X_MIN && raw <= WALK_X_MAX) {
    return { to: +raw.toFixed(2), dir };
  }
  return {
    to: +clamp(from - dir * travel, WALK_X_MIN, WALK_X_MAX).toFixed(2),
    dir: dir === 1 ? -1 : 1,
  };
}

type Acc = { time: number; leg: number; x: number; dir: 1 | -1; stops: BarStop[] };

// Walks until the accumulated real time passes `target`. Time is accumulated,
// never divided into equal slices -- that is what makes the hops uneven.
function step(i: number, size: number, target: number, acc: Acc): Acc {
  if (acc.time >= target) {
    return acc;
  }
  const travel = +mix(i * 7 + acc.leg * 13, TRAVEL_X_MIN, TRAVEL_X_MAX, 12).toFixed(2);
  const x = nudge(acc.x, nextDir(i, acc.leg, acc.dir), travel);
  const dur = hopDuration(i, size, travel);
  return step(i, size, target, {
    time: acc.time + dur,
    leg: acc.leg + 1,
    x: x.to,
    dir: x.dir,
    stops: [
      ...acc.stops,
      { at: +(((acc.time + dur) / target) * 100).toFixed(2), x: x.to },
    ],
  });
}

export function buildBarPath(
  i: number,
  size: number,
): { duration: number; stops: BarStop[] } {
  const target = mix(i, LOOP_DURATION_MIN_S, LOOP_DURATION_MAX_S, 4);
  const startX = +mix(i, -5, 105, 6).toFixed(2);
  const dir: 1 | -1 = mix(i, 0, 1, 50) >= 0.5 ? 1 : -1;
  const acc = step(i, size, target, {
    time: 0,
    leg: 0,
    x: startX,
    dir,
    stops: [{ at: 0, x: startX }],
  });
  // The last hop overshoots `target`, so the percentages run past 100. Rescale
  // to the walk's real length and pin the tail to exactly 100.
  const scale = acc.stops[acc.stops.length - 1].at;
  const normalized = acc.stops.map((s) => ({
    ...s,
    at: +((s.at / scale) * 100).toFixed(2),
  }));
  return {
    duration: +acc.time.toFixed(2),
    stops: [
      ...normalized.slice(0, -1),
      { ...normalized[normalized.length - 1], at: 100 },
    ],
  };
}

export function buildBars(): Bar[] {
  const widths = uniquify(
    Array.from({ length: BAR_COUNT }, (_, i) =>
      mix(i, WIDTH_PCT_MIN, WIDTH_PCT_MAX, 2),
    ),
    2,
  );

  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const size = (widths[i] - WIDTH_PCT_MIN) / (WIDTH_PCT_MAX - WIDTH_PCT_MIN);
    const path = buildBarPath(i, size);
    return {
      width: +widths[i].toFixed(2),
      duration: path.duration,
      // Negative delay: every bar starts mid-walk, so the field is already in
      // motion on first paint instead of marching from a shared origin.
      delay: +(-mix(i, 0, path.duration, 5)).toFixed(2),
      // Separate salts so a bar that waits a long time is not also the one
      // that fades slowest -- the two should not correlate.
      fadeDelay: +mix(i, FADE_IN_MIN_S, FADE_IN_MAX_S, 61).toFixed(2),
      fadeDuration: +mix(i, FADE_IN_MIN_S, FADE_IN_MAX_S, 62).toFixed(2),
      stops: path.stops,
    };
  });
}
