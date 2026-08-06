import { END_ORB_COUNT } from "@/app/_end-glow/build-end-orbs";
import { generateEndGlowCss } from "@/app/_end-glow/generate-end-glow-css";

// The whole effect is one deterministic string: 100 orbs, each with its own
// @keyframes walk, generated from the tunables in end-glow-math.ts. It is built
// once per server process at module load -- NOT per render -- because the math
// has no inputs and never changes at runtime.
//
// It ships as an inline <style> rather than an imported .css file (the way
// site-footer.css does) for one reason: a static file cannot be computed. The
// keyframes come out of buildOrbPath(), so the only alternatives are inlining it
// or adding a build step that writes CSS to disk. Inline wins until the numbers
// stop moving.
const END_GLOW_CSS = generateEndGlowCss();

// Decorative only -- aria-hidden on the root, and no focusable descendants, so
// the whole subtree is invisible to assistive tech. Reduced-motion is handled in
// the generated CSS (orbs stop animating and go transparent; the wash stays).
//
// The root is position: fixed / inset: 0, so this pins to the viewport wherever
// it is mounted and contributes nothing to layout. Drop it anywhere in a page.
export function EndGlow() {
  return (
    <div aria-hidden="true" className="end-glow">
      <style>{END_GLOW_CSS}</style>
      <div className="end-glow__wash" />
      <div className="end-glow__orbs">
        {Array.from({ length: END_ORB_COUNT }, (_, i) => (
          <div className={`end-glow__orb end-glow__orb--${i}`} key={i} />
        ))}
      </div>
    </div>
  );
}
