import { buildOrbs, type Orb } from "@/app/_glow/build-orbs";
import { glowLayersCss, glowMotionCss } from "@/app/_glow/glow-layers-css";

/**
 * The two tracks of one orb.
 *
 * X and opacity go on .glow__orb and Y on its ::before, which is the whole
 * reason this sheet is a fifth of what it was: the two loops repeat on their
 * own schedules and the browser multiplies them, so neither has to spell out
 * the other's length. See LOOP_X_MIN_S in glow-tunables.ts.
 *
 * `translate`, not `transform`. The two elements would compose either way, but
 * the individual property leaves `transform` free on both of them -- and it is
 * the shorter word, over the ~3,000 stops that remain.
 */
function xKeyframes(orb: Orb, i: number): string {
  const body = orb.x.stops
    .map(
      (stop) =>
        `  ${at(stop.at)}% { translate: ${round(stop.value)}cqw 0; opacity: ${stop.opacity}; }`,
    )
    .join("\n");

  return `@keyframes glow-x-${i} {\n${body}\n}`;
}

// Down, from a box that is pinned to the band's bottom edge: the stop stores
// the box's bottom edge in cqh, which is negative for an orb taller than the
// band, and the translation that puts it there is its negation.
function yKeyframes(orb: Orb, i: number): string {
  const body = orb.y.stops
    .map((stop) => `  ${at(stop.at)}% { translate: 0 ${round(-stop.value)}cqh; }`)
    .join("\n");

  return `@keyframes glow-y-${i} {\n${body}\n}`;
}

/**
 * A container query unit, to one decimal. The walk works in hundredths because
 * its bounds checks want the exact number; the stylesheet does not. On the 400px
 * band this glow was measured against, 0.01cqh is four hundredths of a pixel,
 * and a 3px blur is laid over it. Four significant figures of that, three
 * thousand times, is the sheet stating a precision nobody can see.
 */
function round(value: number): number {
  return +value.toFixed(1);
}

// Stop times, same argument. A tenth of a percent of a 26-second loop is 26ms
// -- under two frames, on a hop that lasts about two seconds.
function at(percent: number): number {
  return +percent.toFixed(1);
}

function track(name: string, i: number, walk: Orb["x"]): string {
  return `glow-${name}-${i} ${walk.duration}s linear ${walk.delay}s infinite alternate`;
}

/**
 * The other half of centering an orb on its walk point. Every keyframe stop used
 * to end in a literal `translate(-50%, 0)` -- the same 20 characters repeated
 * across ~12,000 stops, a fifth of the whole stylesheet, saying a constant.
 *
 * A negative margin says it once. The orb is `position: absolute; left: 0` with
 * a definite width and `right: auto`, so its border box starts at
 * `left + margin-left`; half its own width to the left of the walk point is
 * exactly where `translate(-50%, 0)` put it.
 *
 * The percentage case is equivalent for the same reason the transform was: with
 * border-box sizing and no padding or border, `width: 54%` makes the border box
 * 54% of the containing block, and a `margin-left` percentage resolves against
 * that same containing block width -- so -27% is -50% of the box.
 */
function orbCentering(width: string): string {
  const unit = width.endsWith("%") ? "%" : "rem";
  const half = +(Number.parseFloat(width) / 2).toFixed(3);
  return `-${half}${unit}`;
}

export function generateGlowCss(): string {
  const orbs = buildOrbs();
  const keyframes = orbs
    .map((orb, i) => `${xKeyframes(orb, i)}\n${yKeyframes(orb, i)}`)
    .join("\n");
  const rules = orbs
    .map(
      (orb, i) =>
        `.glow__orb--${i} { animation: ${track("x", i, orb.x)}; }\n` +
        `.glow__orb--${i}::before { width: ${orb.width}; height: ${orb.height}%; margin-left: ${orbCentering(orb.width)}; animation: ${track("y", i, orb.y)}; }`,
    )
    .join("\n");

  return `${glowLayersCss()}\n${keyframes}\n${rules}${glowMotionCss()}`.trim();
}
