import { BAR_COUNT } from "@/app/_bars/bars-tunables";
import { generateBarsCss } from "@/app/_bars/generate-bars-css";
import { MotionRegion } from "@/app/_motion/motion-region";

// Same deal as Glow: the effect is one deterministic string built once per
// server process at module load, not per render, because the math has no
// inputs. It ships inline because a static .css file cannot be computed.
const BARS_CSS = generateBarsCss();

// Decorative only -- aria-hidden on the root, no focusable descendants.
// Reduced-motion is handled in the generated CSS (bars stop where they are;
// at 3% alpha there is nothing to fade out).
export function Bars() {
  return (
    <MotionRegion className="bars">
      <style>{BARS_CSS}</style>
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
