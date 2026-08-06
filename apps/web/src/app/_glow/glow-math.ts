
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
  LOOP_DURATION_MAX_S,
  LOOP_DURATION_MIN_S,
  TRAVEL_X_MAX,
  TRAVEL_X_MIN,
  TRAVEL_Y_MAX,
  TRAVEL_Y_MIN,
  WALK_X_MAX,
  WALK_X_MIN,
} from "@/app/_glow/glow-tunables";

export function mix(i: number, a: number, b: number, salt: number): number {
  const t = ((i * 17 + salt * 13) % 97) / 96;
  const u = Math.min(1, Math.max(0, t + Math.sin(i * 1.7 + salt) * 0.156));
  return a + (b - a) * u;
}

export type OrbStop = {
  at: number;
  left: number;
  bottom: number;
  opacity: number;
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
  left: number;
  top: number;
  dirX: 1 | -1;
  dirY: 1 | -1;
  stops: OrbStop[];
};

function flameOpacity(i: number, leg: number, peak: number): number {
  const pulse = Math.abs(
    Math.sin(leg * 0.7 + i * 1.3) * 0.55 + Math.sin(leg * 1.9 + i * 0.4) * 0.45,
  );
  const floor = mix(i, 0.2, 0.45, 33 + (leg % 5));
  return +(peak * (floor + (1 - floor) * pulse)).toFixed(4);
}

function step(
  i: number,
  size: number,
  peak: number,
  height: number,
  topMin: number,
  topMax: number,
  target: number,
  acc: Acc,
): Acc {
  if (acc.time >= target) {
    return acc;
  }
  const travelX = +mix(i * 7 + acc.leg * 13, TRAVEL_X_MIN, TRAVEL_X_MAX, 12).toFixed(2);
  const travelY = +mix(i * 11 + acc.leg * 19, TRAVEL_Y_MIN, TRAVEL_Y_MAX, 16).toFixed(2);
  const x = nudge(acc.left, nextDir(i, acc.leg, 0, acc.dirX), travelX, WALK_X_MIN, WALK_X_MAX);
  const y = nudge(acc.top, nextDir(i, acc.leg, 1, acc.dirY), travelY, topMin, topMax);
  const dur = hopDuration(i, size, Math.max(travelX, travelY));
  const pct = (s: number) => +((s / target) * 100).toFixed(2);
  return step(i, size, peak, height, topMin, topMax, target, {
    time: acc.time + dur,
    leg: acc.leg + 1,
    left: x.to,
    top: y.to,
    dirX: x.dir,
    dirY: y.dir,
    stops: [
      ...acc.stops,
      {
        at: pct(acc.time + dur),
        left: x.to,
        bottom: +(y.to - height).toFixed(2),
        opacity: flameOpacity(i, acc.leg, peak),
      },
    ],
  });
}

export function buildOrbPath(
  i: number,
  size: number,
  peak: number,
  height: number,
  topMin: number,
  topMax: number,
): { duration: number; stops: OrbStop[] } {
  const target = mix(i, LOOP_DURATION_MIN_S, LOOP_DURATION_MAX_S, 4);
  const startLeft = +mix(i, -5, 105, 6).toFixed(2);
  const startTop = +mix(i, topMin, topMax, 15).toFixed(2);
  const dirX: 1 | -1 = mix(i, 0, 1, 50) >= 0.5 ? 1 : -1;
  const dirY: 1 | -1 = mix(i, 0, 1, 51) >= 0.5 ? 1 : -1;
  const first: OrbStop = {
    at: 0,
    left: startLeft,
    bottom: +(startTop - height).toFixed(2),
    opacity: flameOpacity(i, 0, peak),
  };
  const acc = step(i, size, peak, height, topMin, topMax, target, {
    time: 0,
    leg: 0,
    left: startLeft,
    top: startTop,
    dirX,
    dirY,
    stops: [first],
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
