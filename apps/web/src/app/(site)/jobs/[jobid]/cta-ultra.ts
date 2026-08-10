/**
 * What the hero's two buttons hand their Ultra passes.
 *
 * Shared rather than repeated because the surface mask has to match the real
 * plate: `radius` is job-cta.css's own border-radius, and job-cta.test.ts holds
 * the two to the same number. A mask with a different corner from the box it
 * covers shows as a bright sliver at each corner.
 */
export const CTA_RADIUS = 3;

/**
 * The plates' colours, as linear RGB scaled by ULTRA_HEADROOM at paint time.
 *
 * A plate is Ultra the same way a word is -- past reference white -- but it has
 * to stay its own colour, or Apply stops being red and becomes a white slab. So
 * the hue is handed in and the headroom multiplies it: same hue, more light.
 *
 * --accent is #e50914 and --surface is #080202, the two values job-cta.css
 * fills these buttons with, normalised to 0..1.
 */
export const ULTRA_ACCENT: [number, number, number] = [229 / 255, 9 / 255, 20 / 255];

export const ULTRA_SURFACE: [number, number, number] = [8 / 255, 2 / 255, 2 / 255];
