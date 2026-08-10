// Ultra mode - https://UltraDarkMode.com

/**
 * The one knob.
 *
 * Headroom is a linear extended-sRGB value: how far past SDR reference white the
 * Ultra fill is painted. Every Ultra element defaults to this, so changing it
 * here changes both headlines at once.
 *
 *   1.0   SDR reference white -- indistinguishable from plain #ffffff
 *   1.6   subtle lift, safe on displays with little headroom
 *   2.2   default; clearly brighter, matches color(rec2100-linear 2.2 2.2 2.2)
 *   4.0+  aggressive; clips on modest displays and reads as blown out
 *
 * Never tune brightness with opacity, colour or a CSS filter. This is the value
 * the fill is painted at, and the only place it is decided.
 */
export const ULTRA_HEADROOM = 4;

/**
 * How far the Ultra overlay layers grow past the box they cover, per side, as a
 * percentage.
 *
 * The mask viewport is a rectangle. Pinned to the text box it IS the line box,
 * so a glyph that overshoots it -- an accent, a descender, the tail of a G -- is
 * cut off with a straight edge the letterform does not have. Growing both layers
 * symmetrically puts the cut somewhere no glyph reaches.
 *
 * ultra.css states it as `--ultra-bleed` and derives both the negative inset and
 * the 200% size from it; ultra-bleed.test.ts holds the two to this number.
 */
export const ULTRA_BLEED = 50;
