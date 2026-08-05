import { END_ORB_COUNT } from "@/app/foo/build-end-orbs";
import { generateEndGlowCss } from "@/app/foo/generate-end-glow-css";

const END_GLOW_CSS = generateEndGlowCss();

export default function Base() {
  return (
    <div className="end-glow" aria-hidden="true">
      <style>{END_GLOW_CSS}</style>
      <div className="end-glow__wash" />
      {Array.from({ length: END_ORB_COUNT }, (_, i) => (
        <div key={i} className={`end-glow__orb end-glow__orb--${i}`} />
      ))}
    </div>
  );
}
