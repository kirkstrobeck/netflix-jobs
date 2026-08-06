import { generateGlowCss } from "@/app/_glow/generate-glow-css";
import { ORB_COUNT } from "@/app/_glow/glow-math";

// The whole effect is one deterministic string: one @keyframes walk per orb,
// generated from the tunables in glow-math.ts. It is built once per server
// process at module load -- NOT per render -- because the math has no inputs and
// never changes at runtime.
//
// It ships as an inline <style> rather than an imported .css file (the way
// site-footer.css does) for one reason: a static file cannot be computed. The
// keyframes come out of buildOrbPath(), so the only alternatives are inlining it
// or adding a build step that writes CSS to disk. Inline wins until the numbers
// stop moving.
const GLOW_CSS = generateGlowCss();

// Decorative only -- aria-hidden on the root, and no focusable descendants, so
// the whole subtree is invisible to assistive tech. Reduced-motion is handled in
// the generated CSS (orbs stop animating and go transparent; the wash stays).
//
// The root is position: absolute / inset: 0 and contributes nothing to layout,
// so it fills whichever positioned ancestor it is dropped into. Text placed over
// it needs a scrim: the wash reaches opaque #e50914 at the bottom edge, which is
// only 4.4:1 against --ink. See .job-footer__scrim.
export function Glow() {
  return (
    <div aria-hidden="true" className="glow">
      <style>{GLOW_CSS}</style>
      <div className="glow__wash" />
      <div className="glow__orbs">
        {Array.from({ length: ORB_COUNT }, (_, i) => (
          <div className={`glow__orb glow__orb--${i}`} key={i} />
        ))}
      </div>
    </div>
  );
}
