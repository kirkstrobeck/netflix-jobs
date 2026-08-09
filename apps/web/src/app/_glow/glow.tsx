import { ORB_COUNT } from "@/app/_glow/glow-math";
import { MotionRegion } from "@/app/_motion/motion-region";

// The whole effect is one deterministic string: one @keyframes walk per orb,
// generated from the tunables in glow-math.ts. It has no inputs and never
// changes at runtime, so it is written to disk by tools/write-generated-css.mjs
// and imported here like any other stylesheet.
//
// It used to ship as an inline <style> instead, on the reasoning that a static
// file cannot be computed. It can -- the generator just has to run at build time
// rather than at module load. And the inline version was expensive twice over:
// the App Router inlines the RSC flight payload into the same document, that
// payload carries the rendered element tree, and a <style>'s CSS is a text child
// of it -- so ~950KB of keyframes went out as HTML and again as flight data on
// every single request, uncacheable, on the critical path.
//
// As an import it becomes a content-hashed file under /_next/static, which Next
// serves immutable and the bundler minifies. The document carries a <link>.
import "@/app/_glow/glow.generated.css";

// Decorative only -- aria-hidden on the root, and no focusable descendants, so
// the whole subtree is invisible to assistive tech. Reduced-motion is handled in
// the generated CSS (orbs stop animating and go transparent; the wash stays).
//
// The root is position: absolute / inset: 0 and contributes nothing to layout,
// so it fills whichever positioned ancestor it is dropped into. Text placed over
// it needs a scrim: the wash reaches opaque #e50914 at the bottom edge, which is
// only 4.4:1 against --ink. See .job-footer::before.
//
// One layer here has no element: .glow::before is the wash's ground, pinned to
// the bottom edge of this box. It is a pseudo-element so it costs no markup, and
// it carries no z-index so it stays under the wash and cannot reach out into the
// consumer's stacking context. See the rule in generate-glow-css.ts.
export function Glow() {
  return (
    <MotionRegion className="glow">
      <div className="glow__wash" />
      <div className="glow__orbs">
        {Array.from({ length: ORB_COUNT }, (_, i) => (
          <div className={`glow__orb glow__orb--${i}`} key={i} />
        ))}
      </div>
    </MotionRegion>
  );
}
