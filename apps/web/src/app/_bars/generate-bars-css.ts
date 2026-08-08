import { BAR_ALPHA, BAR_RGB, BARS_BLUR_PX } from "@/app/_bars/bars-tunables";
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
        // The shell only carries the width; the mover inside it is the only
        // thing with an animation on it.
        `.bars__bar--${i} { width: ${bar.width}%; }\n` +
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
/* Each bar is two elements: the shell sizes and places it and never moves, the
   mover inside carries the walk. No opacity anywhere -- a bar is at full
   BAR_ALPHA on first paint and stays there.

   top/bottom rather than height so the bar spans the field whatever its size,
   and left: 0 so the keyframe translate is the only thing placing it on X. */
.bars__bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
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
${keyframes}
${rules}
/* Off-screen, or in a background tab. play-state rather than animation: none,
   so a bar holds its position and carries on from there -- none would snap every
   bar back to its declared transform. Only the mover animates now, so it is the
   only thing to pause. .bars__layer keeps its blur; there is nothing to
   composite while paused. */
.bars.${PAUSED_CLASS} .bars__mover {
  animation-play-state: paused;
}
/* No opacity to restore: a bar's resting state is already full strength, so
   stopping the walk is the whole of reduced motion. */
@media (prefers-reduced-motion: reduce) {
  .bars__mover { animation: none !important; }
}
`.trim();
}
