import {
  BAR_ALPHA,
  BAR_RGB,
  BARS_BLUR_PX,
  FADE_IN_FROM,
} from "@/app/_bars/bars-tunables";
import { PAUSED_CLASS } from "@/app/_motion/pause-when-idle";
import { buildBars } from "@/app/_bars/build-bars";

// How far the blurred layer overhangs the clip, top and bottom. Three times the
// radius is past where a Gaussian blur has anything left to contribute.
const BLEED_PX = BARS_BLUR_PX * 3;

// X only. The Y slot is a literal 0 -- the whole point of this field is that
// bars sweep laterally and never rise or fall.
//
// translate(-50%, 0) centers the bar on its walk point, the way an orb is
// centered on its. Without it a bar hangs off to the right of its coordinate,
// so a 20%-wide bar and a 2%-wide one at the same x sit visibly differently and
// the field stops reading as an even scatter.
function barTransform(x: number): string {
  return `translate3d(${x}cqw, 0, 0) translate(-50%, 0)`;
}

function barKeyframes(bar: ReturnType<typeof buildBars>[number], i: number): string {
  const body = bar.stops
    .map((stop) => `  ${stop.at}% { transform: ${barTransform(stop.x)}; }`)
    .join("\n");
  return `@keyframes bars-bar-${i} {
${body}
}`;
}

export function generateBarsCss(): string {
  const bars = buildBars();
  const keyframes = bars.map((bar, i) => barKeyframes(bar, i)).join("\n");
  const rules = bars
    .map(
      (bar, i) =>
        // One animation per element, on two elements: the shell fades once, the
        // mover inside it walks forever. Nothing about the entrance can reach
        // the walk, because they no longer share an animation list.
        `.bars__bar--${i} { width: ${bar.width}%; animation: bars-fade-in ${bar.fadeDuration}s linear ${bar.fadeDelay}s 1 normal forwards; }\n` +
        `.bars__mover--${i} { animation: bars-bar-${i} ${bar.duration}s linear ${bar.delay}s infinite alternate; }`,
    )
    .join("\n");

  return `
/* The stage: the positioned box <Bars /> fills. It sets no height of its own --
   it takes the one its content or its caller's class gives it. */
.bars-stage {
  position: relative;
}
/* Lifts the real content over the backdrop. z-index alone is not enough on a
   static element, hence position: relative. */
.bars-stage__content {
  position: relative;
  z-index: 1;
}
/* absolute, not fixed: the field fills its nearest positioned ancestor, so it
   is the caller's job to make that ancestor position: relative.

   Two layers, the way .glow wraps .glow__orbs: the outer one owns the clip and
   the inner one owns the blur. overflow: hidden here clips both the bars that
   walk past the sides and the blur's spill. */
.bars {
  pointer-events: none;
  position: absolute;
  inset: 0;
  overflow: hidden;
}
/* The blur goes on this layer once, not on each bar -- 25 filtered elements
   would each get their own surface, and their overlaps would blur separately
   instead of as one field.

   It is inset ${BLEED_PX}px past the top and bottom on purpose. A blur softens
   alpha outward from its edge, so a layer flush with the clip would fade the
   bars' top and bottom ends into the black. Overhanging the clip means the soft
   part lands outside .bars and gets cut, leaving those ends sharp. Sides are
   flush -- bars are meant to fade as they walk off. */
.bars__layer {
  position: absolute;
  inset: ${-BLEED_PX}px 0;
  container-type: size;${BARS_BLUR_PX > 0 ? `\n  filter: blur(${BARS_BLUR_PX}px);` : ""}
}
/* Each bar is two elements. The shell owns opacity and never moves; the mover
   inside owns transform and never changes opacity. Splitting them means the
   entrance and the walk are separate animations on separate elements, so
   neither can hold the other at a single frame.

   The shell sizes and places the bar: top/bottom rather than height so it spans
   the field whatever its size, and left: 0 so the keyframe translate is the only
   thing placing it on X.

   opacity here is the pre-entrance state. The fade carries no backwards fill, so
   during its delay the bar sits at this declared value; forwards fill holds it
   at the end value afterwards. */
.bars__bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  opacity: ${FADE_IN_FROM};
}
/* The mover fills its shell, so the -50% in the keyframe transform still
   measures the bar's own width. The fill lives here rather than on the shell
   because this is the box that moves. */
.bars__mover {
  block-size: 100%;
  inline-size: 100%;
  background: rgb(${BAR_RGB} / ${BAR_ALPHA});
  backface-visibility: hidden;
}
/* The fade runs to opacity 1, not to BAR_ALPHA: the alpha already lives in the
   background above, so ending at BAR_ALPHA here would multiply the two and land
   at BAR_ALPHA squared. One alpha, one place. */
@keyframes bars-fade-in {
  from { opacity: ${FADE_IN_FROM}; }
  to { opacity: 1; }
}
${keyframes}
${rules}
/* Off-screen, or in a background tab. play-state rather than animation: none,
   so a bar holds its position and its entrance progress and carries on from
   there -- none would snap every bar back to its declared state and replay the
   fade on the way back. .bars__layer keeps its blur; there is nothing to
   composite while paused. */
.bars.${PAUSED_CLASS} .bars__bar,
.bars.${PAUSED_CLASS} .bars__mover {
  animation-play-state: paused;
}
/* opacity: 1 is load-bearing here, not a tweak. Killing the animations also
   kills the entrance, and the bar's declared opacity is FADE_IN_FROM -- without
   this the reduced-motion field would paint at half strength forever. */
@media (prefers-reduced-motion: reduce) {
  .bars__bar { animation: none !important; opacity: 1; }
  .bars__mover { animation: none !important; }
}
`.trim();
}
