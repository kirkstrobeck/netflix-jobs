import { BarsStage } from "@/app/_bars/bars-stage";
import { UltraText } from "@/app/_ultra/ultra-text";

// The page's one h1. "Open roles" below it is an h2, so the outline runs
// h1 -> h2 (the listing, and the filters panel) -> h3 (each result).
// The apostrophe is U+2019 RIGHT SINGLE QUOTATION MARK, not ASCII U+0027 --
// this is typeset copy, and the straight quote is a typewriter artefact. Its
// test asserts the codepoint, so an editor that "helpfully" normalises it back
// to a straight quote fails rather than silently downgrading the headline.
export const HEADLINE = "Be part of what’s next";

// The same red-bar field the job masthead carries, mounted through the same
// <BarsStage> rather than rebuilt: the stage is the positioned box, <Bars />
// fills it, and .bars-stage__content lifts the headline over the top.
//
// The stage is a FULL-WIDTH BAND with a .shell inside it, which is the same
// shape .site-header has. That is what puts the masthead's divider across the
// whole page: the rule is this element's border, so the element is the thing
// that has to reach the edges. The headline stays in the 76rem column because
// the shell it now sits in is the same shell it used to inherit from <main>.
//
// The headline needs no scrim. The bars are BAR_RGB 229 9 20 at BAR_ALPHA 0.15
// each, so the darkest a stack of them can ever make the backdrop is
// 1 - 0.85^15 = 0.9126 -- rgb(210,8,18) over --surface -- against which --ink
// measures 5.10:1. That is the ceiling, not an average: it assumes all fifteen
// bars overlapping the same pixel, which the walk never actually does (the worst
// frame in a full sweep of the loop is eight, at 7.08:1). Both clear AA, so the
// contrast holds on every frame rather than on a typical one.
//
// Every number here is derived from _bars/bars-tunables.ts and moves when those
// do. It read 6.28:1 and rgb(183,8,16) while BAR_ALPHA was 0.10; the retune to
// 0.15 is what changed it. home-masthead.test.tsx pins the 15-bar ceiling and
// asserts the AA floor, so a further retune fails there rather than rotting here.
export function HomeMasthead() {
  return (
    <BarsStage as="header" className="masthead" contentClassName="shell">
      {/* The h1 is <UltraText>'s, and it still carries .masthead__title --
          every type rule below is unchanged and both copies of the word inherit
          it. What is added is the Ultra fill: a WebGPU canvas painted past SDR
          reference white and masked to these letterforms. */}
      <UltraText as="h1" className="masthead__title">{HEADLINE}</UltraText>
    </BarsStage>
  );
}
