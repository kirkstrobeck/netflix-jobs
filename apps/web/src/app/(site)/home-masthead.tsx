import { BarsStage } from "@/app/_bars/bars-stage";

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
// The headline needs no scrim. The bars are #e50914 at 0.10 alpha each, so the
// darkest a stack of them can ever make the backdrop is 1 - 0.9^15 = 0.794 --
// rgb(183,8,16) over --surface -- against which --ink measures 6.28:1. That is
// the ceiling, not an average: it assumes all fifteen bars overlapping the same
// pixel, which the walk never actually does (the worst frame in a full sweep of
// the loop is eight, at 9.43:1). Both clear AA, so the contrast holds on every
// frame rather than on a typical one.
export function HomeMasthead() {
  return (
    <BarsStage as="header" className="masthead">
      <h1 className="masthead__title">{HEADLINE}</h1>
    </BarsStage>
  );
}
