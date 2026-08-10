
/**
 * Path math for the glow. The mins/maxes this reads from live in
 * ./glow-tunables — that is the file to edit to retune the effect.
 *
 * Re-exported here rather than left to callers to import separately: every
 * consumer wants a tunable and a function together, and this file was a single
 * "tunables above, math below" module until the tunables' own commentary pushed
 * it past the 200-line limit. The split is the file length, not a new boundary.
 */
export * from "@/app/_glow/glow-tunables";

import {
  FLIP_ODDS_X_MAX,
  FLIP_ODDS_X_MIN,
  FLIP_ODDS_Y_MAX,
  FLIP_ODDS_Y_MIN,
  HOP_DURATION_FAST_S,
  HOP_DURATION_FLOOR_S,
  HOP_DURATION_SLOW_S,
} from "@/app/_glow/glow-tunables";

export function mix(i: number, a: number, b: number, salt: number): number {
  const t = ((i * 17 + salt * 13) % 97) / 96;
  const u = Math.min(1, Math.max(0, t + Math.sin(i * 1.7 + salt) * 0.156));
  return a + (b - a) * u;
}

/**
 * One stop of one axis. `value` is cqw along X and cqh up Y; `opacity` is on
 * the X stops only, because that is the one track carrying it.
 */
export type WalkStop = { at: number; value: number; opacity?: number };

export type Walk = { duration: number; stops: WalkStop[] };

/** Which walk to build. `peak` opts the stops into carrying the flame. */
export type WalkSpec = {
  seed: number;
  axis: 0 | 1;
  size: number;
  lo: number;
  hi: number;
  travelMin: number;
  travelMax: number;
  target: number;
  peak?: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function hopDuration(i: number, size: number, travel: number): number {
  const s = clamp(size, 0, 1);
  const base =
    HOP_DURATION_FAST_S + (1 - s) * (HOP_DURATION_SLOW_S - HOP_DURATION_FAST_S);
  return Math.max(
    HOP_DURATION_FLOOR_S,
    base * mix(i, 0.92, 1.08, 4) * (travel / 100),
  );
}

function nextDir(i: number, leg: number, axis: number, prev: 1 | -1): 1 | -1 {
  const lo = axis === 0 ? FLIP_ODDS_X_MIN : FLIP_ODDS_Y_MIN;
  const hi = axis === 0 ? FLIP_ODDS_X_MAX : FLIP_ODDS_Y_MAX;
  const flip = mix(i * 31 + axis * 17, lo, hi, 40 + (leg % 11));
  if (mix(i * 97 + leg * 53 + axis * 71, 0, 1, 100 + leg + axis * 3) < flip) {
    return prev === 1 ? -1 : 1;
  }
  return prev;
}

// The bounce is clamped, not just reversed. Reversing alone is only safe while
// the band is at least two hops wide: from a position near one edge, `from -
// dir * travel` can overshoot the OTHER edge, and once a walk is outside its
// band every subsequent hop is out of range too, so the reversal keeps pushing
// it further out instead of pulling it back. That is how orbs bounded to
// [28.4, 55.4] were reaching 165cqh and getting sliced by the band's top edge.
// Y bands here can be as narrow as 27cqh against hops of up to TRAVEL_Y_MAX, so
// clamping the bounce back into [lo, hi] is what actually holds the ceiling.
function nudge(
  from: number,
  dir: 1 | -1,
  travel: number,
  lo: number,
  hi: number,
): { to: number; dir: 1 | -1 } {
  const raw = from + dir * travel;
  if (raw >= lo && raw <= hi) {
    return { to: +raw.toFixed(2), dir };
  }
  return {
    to: +clamp(from - dir * travel, lo, hi).toFixed(2),
    dir: dir === 1 ? -1 : 1,
  };
}

type Acc = {
  time: number;
  leg: number;
  at: number;
  dir: 1 | -1;
  stops: WalkStop[];
};

function flameOpacity(i: number, leg: number, peak: number): number {
  const pulse = Math.abs(
    Math.sin(leg * 0.7 + i * 1.3) * 0.55 + Math.sin(leg * 1.9 + i * 0.4) * 0.45,
  );
  const floor = mix(i, 0.2, 0.45, 33 + (leg % 5));
  return +(peak * (floor + (1 - floor) * pulse)).toFixed(3);
}

// The flame rides the X walk rather than a track of its own. An element takes
// several animations at once as long as they touch different properties, so a
// third one here would cost a third @keyframes block to say what these stops
// have room for -- and the pulse is per-leg, which is the rhythm this walk
// already keeps.
function walkStop(spec: WalkSpec, leg: number, at: number, value: number): WalkStop {
  if (spec.peak === undefined) {
    return { at, value };
  }

  return { at, value, opacity: flameOpacity(spec.seed, leg, spec.peak) };
}

function step(spec: WalkSpec, acc: Acc): Acc {
  if (acc.time >= spec.target) {
    return acc;
  }

  const travel = +mix(
    spec.seed * (7 + spec.axis * 4) + acc.leg * (13 + spec.axis * 6),
    spec.travelMin,
    spec.travelMax,
    12 + spec.axis * 4,
  ).toFixed(2);
  const next = nudge(
    acc.at,
    nextDir(spec.seed, acc.leg, spec.axis, acc.dir),
    travel,
    spec.lo,
    spec.hi,
  );
  const time = acc.time + hopDuration(spec.seed, spec.size, travel);

  return step(spec, {
    time,
    leg: acc.leg + 1,
    at: next.to,
    dir: next.dir,
    stops: [
      ...acc.stops,
      walkStop(spec, acc.leg, +((time / spec.target) * 100).toFixed(2), next.to),
    ],
  });
}

/**
 * One axis of one orb's drift, as a loop of `target` seconds.
 *
 * Both axes are the same walk with different bounds, so they are the same
 * function: a bounded hop that bounces off its own limits. What used to make
 * this one function do two axes at once was the belief that a stop has to carry
 * a whole position. It does not -- the two loops live on two elements and
 * multiply, so each may repeat on its own schedule, which is the entire reason
 * the sheet is a fifth of the size.
 *
 * Stops land on hop boundaries, and the last is dragged to exactly 100% so the
 * loop closes on a stop rather than a fraction past one.
 */
export function buildWalk(spec: WalkSpec): Walk {
  const start = +mix(spec.seed, spec.lo, spec.hi, 6 + spec.axis * 9).toFixed(2);
  const dir: 1 | -1 = mix(spec.seed, 0, 1, 50 + spec.axis) >= 0.5 ? 1 : -1;
  const acc = step(spec, {
    time: 0,
    leg: 0,
    at: start,
    dir,
    stops: [walkStop(spec, 0, 0, start)],
  });
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
