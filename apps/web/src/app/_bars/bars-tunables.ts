/**
 * Bars tunables — edit these mins/maxes to retune the effect. The path math
 * that reads them is in ./build-bars.
 *
 * The X knobs deliberately carry glow's values: the walk is the same walk, so
 * start positions, flips and speeds get the same even randomness. There is no
 * Y here at all — bars only move laterally.
 *
 * Speed: lower HOP_DURATION_*_S = faster. Min speed → SLOW; max speed → FAST.
 */
export const BAR_COUNT = 15;
/** Widths are a share of the container: 20% down to 2%. */
export const WIDTH_PCT_MAX = 20;
export const WIDTH_PCT_MIN = 2;
/** Solid fill, no gradient. One flat alpha for every bar. */
export const BAR_RGB = "229 9 20";
export const BAR_ALPHA = 0.1;
/** One blur over the whole layer, not per bar. 0 disables the filter. */
export const BARS_BLUR_PX = 2;
/**
 * One-time entrance. Each bar draws both its delay and its fade length from
 * this range, so the field arrives staggered rather than all at once. This is
 * the ONLY opacity animation in the effect -- the walk is transform-only, and
 * a bar "enters" or "leaves" by walking onto or off the clipped edges.
 */
export const FADE_IN_MIN_S = 1;
export const FADE_IN_MAX_S = 3;
/**
 * Where the entrance starts. Not 0 -- the field is already faintly present on
 * first paint and the fade brings it the rest of the way up, rather than
 * arriving out of nothing. This is a multiplier on BAR_ALPHA, not an alpha
 * itself: the fade ends at 1, which is BAR_ALPHA as declared on the background.
 */
export const FADE_IN_FROM = 0.5;
/** X walk band, in cqw. Outside 0..100 so bars enter and leave the frame. */
export const WALK_X_MIN = -18;
export const WALK_X_MAX = 118;
/** Per-hop lateral travel, in cqw. */
export const TRAVEL_X_MIN = 10;
export const TRAVEL_X_MAX = 22;
export const HOP_DURATION_FAST_S = 18.57;
export const HOP_DURATION_SLOW_S = 177.14;
export const HOP_DURATION_FLOOR_S = 2;
export const LOOP_DURATION_MIN_S = 207.69;
export const LOOP_DURATION_MAX_S = 253.85;
/** Flips read as changes of mind rather than glow's rare technical sweeps. */
export const FLIP_ODDS_X_MIN = 0.32;
export const FLIP_ODDS_X_MAX = 0.6;
