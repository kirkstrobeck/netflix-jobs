// WCAG 2.x relative luminance and contrast, over [r, g, b] triples read out of
// a screenshot. Split out of cta.mjs to keep that file under the line limit,
// and because any probe that samples pixels wants the same four functions.

const channel = (c) => {
  const v = c / 255;

  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const luminance = ([r, g, b]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
};

export const brightest = (pixels) =>
  pixels.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));

export const hex = ([r, g, b]) =>
  `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
