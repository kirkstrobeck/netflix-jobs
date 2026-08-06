export function uniquify(values: number[], digits: number): number[] {
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
