function bez1d(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
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
