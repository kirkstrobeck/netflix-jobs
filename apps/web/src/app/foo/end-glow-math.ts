function bez1d(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

function refineT(
  t: number,
  x: number,
  x1: number,
  x2: number,
  steps: number,
): number {
  if (steps <= 0) {
    return t;
  }
  const xEst = bez1d(t, x1, x2);
  const d = (bez1d(t + 1e-6, x1, x2) - xEst) / 1e-6;
  if (Math.abs(d) < 1e-9) {
    return t;
  }
  return refineT(t - (xEst - x) / d, x, x1, x2, steps - 1);
}

export function cubicBezier(
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
  return bez1d(Math.min(1, Math.max(0, refineT(x, x, x1, x2, 10))), y1, y2);
}

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

const LOOP_S = 300;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function hopDuration(i: number, size: number, travel: number): number {
  const base = mix(i, 4, 36.4, 4) / 0.75 / 0.7 / 0.75;
  const sized = base * ((1.9 - size * 1.4) / 1.2);
  const full = Math.max(sized, 22 + (1 - size) * 30);
  // +25% min speed ×3, then +20%; prior +25%/+25% on fast end.
  const slowMax = 90 / 1.25 / 1.25 / 1.25 / 1.2;
  const fastMin = Math.min(
    slowMax,
    ((22 / 1.25 / 1.15) * (1 / 0.6) * (1 / 0.7)) / 1.25 / 1.25,
  );
  const t = clamp((full - 22) / (90 - 22), 0, 1);
  return Math.max(
    3.2 / 1.25 / 1.25,
    (fastMin + t * (slowMax - fastMin)) * (travel / 100),
  );
}

/** Irregular runs — sometimes keep going, sometimes snap back (not LRLR). */
function nextDir(i: number, leg: number, axis: number, prev: 1 | -1): 1 | -1 {
  const flipOdds = mix(i * 31 + axis * 17, 0.28, 0.58, 40 + (leg % 11));
  const roll = mix(i * 97 + leg * 53 + axis * 71, 0, 1, 100 + leg + axis * 3);
  if (roll < flipOdds) {
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
  const travelX = +mix(i * 7 + acc.leg * 13, 3, 14, 12 + (acc.leg % 9)).toFixed(2);
  const travelY = +mix(i * 11 + acc.leg * 19, 6, 24, 16 + (acc.leg % 8)).toFixed(2);
  const x = nudge(acc.left, nextDir(i, acc.leg, 0, acc.dirX), travelX, -18, 118);
  const y = nudge(acc.top, nextDir(i, acc.leg, 1, acc.dirY), travelY, topMin, topMax);
  const dur = hopDuration(i, size, Math.max(travelX, travelY));
  const pct = (s: number) => +((s / target) * 100).toFixed(2);
  const stop: OrbStop = {
    at: pct(acc.time + dur),
    left: x.to,
    bottom: +(y.to - height).toFixed(2),
    opacity: flameOpacity(i, acc.leg, peak),
  };
  return step(i, size, peak, height, topMin, topMax, target, {
    time: acc.time + dur,
    leg: acc.leg + 1,
    left: x.to,
    top: y.to,
    dirX: x.dir,
    dirY: y.dir,
    stops: [...acc.stops, stop],
  });
}

/** Continuous flame walk: short steps, messy flips, ~5 minutes. */
export function buildOrbPath(
  i: number,
  size: number,
  peak: number,
  height: number,
  topMin: number,
  topMax: number,
): { duration: number; stops: OrbStop[] } {
  const target = mix(i, LOOP_S * 0.9, LOOP_S * 1.1, 4);
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
