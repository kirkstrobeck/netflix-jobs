import { BAR_COUNT } from "@/app/_bars/bars-tunables";
import { MotionRegion } from "@/app/_motion/motion-region";

// Same deal as Glow: the effect is one deterministic string with no inputs, so
// tools/write-generated-css.mjs computes it at build time and it is imported
// here. Inline <style> shipped it twice per request -- once as HTML, once inside
// the RSC flight payload -- and cached neither copy.
import "@/app/_bars/bars.generated.css";

// Decorative only -- aria-hidden on the root, no focusable descendants.
// Reduced-motion is handled in the generated CSS (bars stop where they are;
// at 3% alpha there is nothing to fade out).
export function Bars() {
  return (
    <MotionRegion className="bars">
      <div className="bars__layer">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div className={`bars__bar bars__bar--${i}`} key={i}>
            <div className={`bars__mover bars__mover--${i}`} />
          </div>
        ))}
      </div>
    </MotionRegion>
  );
}
