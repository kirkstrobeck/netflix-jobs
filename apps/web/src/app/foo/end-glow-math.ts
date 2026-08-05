/**
 * End-glow tunables — edit these mins/maxes; path math is below.
 * Speed: lower HOP_DURATION_*_S = faster. Min speed → SLOW; max speed → FAST.
 */
export const ORB_COUNT = 50;
export const OPACITY_MIN = 0.05;
export const OPACITY_MAX = 0.5;
export const WIDTH_REM_MIN = 3.401;
export const WIDTH_REM_MAX = 9.48;
export const WIDTH_PCT_MIN = 54.42;
export const WIDTH_PCT_MAX = 141.14;
export const HOP_DURATION_FAST_S = 7.98;
export const HOP_DURATION_SLOW_S = 20.52;
export const HOP_DURATION_FLOOR_S = 0.7;
export const LOOP_DURATION_MIN_S = 207.69;
export const LOOP_DURATION_MAX_S = 253.85;
export const TRAVEL_X_MIN = 3;
export const TRAVEL_X_MAX = 14;
export const TRAVEL_Y_MIN = 6;
export const TRAVEL_Y_MAX = 24;
export const WALK_X_MIN = -18;
export const WALK_X_MAX = 118;
export const TOP_MAX_MIX_MIN = 55;
export const TOP_FLUSH_EVERY_N = 6;
export const Y_SPAN_MIN = 27;
export const Y_SPAN_MAX = 60;
export const TOP_FLOOR = 25;
export const VISIBLE_SPHERE_MAX = 0.35;
export const HEIGHT_EXTRA_MAX = 1.2;
export const FLIP_ODDS_MIN = 0.28;
export const FLIP_ODDS_MAX = 0.58;
export const ORBS_BLUR_PX = 0;
export const WASH_BEZIER_X1 = 0.12;
export const WASH_BEZIER_Y1 = 0.72;
export const WASH_BEZIER_X2 = 0.22;
export const WASH_BEZIER_Y2 = 1;

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

function hopDuration(i: number, size: number, travel: number): number {
  const s = clamp(size, 0, 1);
  const base =
    HOP_DURATION_FAST_S + (1 - s) * (HOP_DURATION_SLOW_S - HOP_DURATION_FAST_S);
  return Math.max(
    HOP_DURATION_FLOOR_S,
    base * mix(i, 0.92, 1.08, 4) * (travel / 100),
  );
}

function nextDir(i: number, leg: number, axis: number, prev: 1 | -1): 1 | -1 {
  const flip = mix(
    i * 31 + axis * 17,
    FLIP_ODDS_MIN,
    FLIP_ODDS_MAX,
    40 + (leg % 11),
  );
  if (mix(i * 97 + leg * 53 + axis * 71, 0, 1, 100 + leg + axis * 3) < flip) {
    return prev === 1 ? -1 : 1;
  }
  return prev;
}

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
  return { to: +(from - dir * travel).toFixed(2), dir: dir === 1 ? -1 : 1 };
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
  const last = acc.stops[acc.stops.length - 1];
  const scale = last?.at || 100;
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
