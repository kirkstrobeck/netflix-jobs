/**
 * Glow tunables — edit these mins/maxes to retune the effect. The path math
 * that reads them is in ./glow-math, which also re-exports this whole module,
 * so importing from either one gets you the same names.
 *
 * Speed: lower HOP_DURATION_*_S = faster. Min speed → SLOW; max speed → FAST.
 */
export const ORB_COUNT = 100;
export const OPACITY_MIN = 0.05;
export const OPACITY_MAX = 0.575;
export const WIDTH_REM_MIN = 3.401;
export const WIDTH_REM_MAX = 9.48;
export const WIDTH_PCT_MIN = 54.42;
export const WIDTH_PCT_MAX = 141.14;
export const HOP_DURATION_FAST_S = 7.98;
export const HOP_DURATION_SLOW_S = 20.52;
export const HOP_DURATION_FLOOR_S = 0.7;
/**
 * The two loops an orb's drift is composed from, in seconds — X first, then Y.
 *
 * There used to be ONE loop of 207–254s, written out as a keyframe stop per
 * hop. A hop lasts about 2.3s, so that was ~100 stops per orb and ~9,900 stops
 * in the sheet: 768KB of the 785KB it came to. The size of the stylesheet was
 * the LENGTH of the loop, which is the wrong thing for it to be proportional
 * to — none of those stops says anything the ones around it do not.
 *
 * The two axes are separate animations on two elements now — X on .glow__orb,
 * Y on its ::before — and transforms multiply down the tree, so the orb's
 * position is still their sum. What changes is when the pair REPEATS: not when
 * either loop comes round, but when both do at once. `alternate` doubles each
 * to ~44–56s and ~50–62s, no two orbs share a duration, and the two ranges do
 * not overlap, so no orb's pair comes back into phase inside a session. That is
 * a longer effective loop than the single one it replaces, from a fifth of the
 * stops.
 *
 * Raise these and the sheet grows in step; each extra second of loop is another
 * 0.43 of a stop per axis per orb.
 */
export const LOOP_X_MIN_S = 22.14;
export const LOOP_X_MAX_S = 28.06;
export const LOOP_Y_MIN_S = 25.31;
export const LOOP_Y_MAX_S = 31.47;
export const TRAVEL_X_MIN = 10;
export const TRAVEL_X_MAX = 22;
export const TRAVEL_Y_MIN = 6;
export const TRAVEL_Y_MAX = 24;
export const WALK_X_MIN = -18;
export const WALK_X_MAX = 118;
export const TOP_MAX_MIX_MIN = 55;
export const TOP_FLUSH_EVERY_N = 6;
export const Y_SPAN_MIN = 27;
export const Y_SPAN_MAX = 60;
export const TOP_FLOOR = 25;
/**
 * Ceiling on an orb's vertical travel, in cqh: the highest its box top edge may
 * reach. Below 100 on purpose. An orb is a radial gradient clipped to a
 * border-radius: 50% ellipse, so it paints nothing above its own box -- but
 * .glow has overflow: hidden and .glow__orbs carries filter: blur(ORBS_BLUR_PX),
 * and the blur spreads alpha past the box before that clip applies. An orb
 * allowed all the way to 100 gets that spill sliced off by the band's top edge
 * as a hard horizontal line. 92 leaves 8cqh -- 32px at the 400px band -- which
 * is far more than the 3px blur needs, so the orb fades out on its own terms
 * instead of being cut off.
 */
export const TOP_CEILING = 92;
export const VISIBLE_SPHERE_MAX = 0.35;
export const HEIGHT_EXTRA_MAX = 1.2;
/** Lateral flips stay rare (technical sweeps); Y can still wander. */
export const FLIP_ODDS_X_MIN = 0.08;
export const FLIP_ODDS_X_MAX = 0.2;
export const FLIP_ODDS_Y_MIN = 0.28;
export const FLIP_ODDS_Y_MAX = 0.55;
export const ORBS_BLUR_PX = 3;
export const WASH_BEZIER_X1 = 0.12;
export const WASH_BEZIER_Y1 = 0.72;
export const WASH_BEZIER_X2 = 0.22;
export const WASH_BEZIER_Y2 = 1;
