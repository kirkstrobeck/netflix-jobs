# probe

Ad-hoc browser probes. Not a gate — nothing in CI runs these. They exist because
several claims in this repo are only checkable by driving a real engine, and
"went and looked" beats "reasoned about the stylesheet".

Run the sysroot Chromium from `tools/chromium/install.sh` via playwright-core:

    bash tools/chromium/install.sh          # once; idempotent
    pnpm --filter web build
    pnpm --filter web exec next start --port 3103 &
    . tools/probe/env.sh

Then:

| script        | question it answers                                              |
| ------------- | ---------------------------------------------------------------- |
| `probe.mjs`   | what one element computes to, at a given viewport width           |
| `sweep.mjs`   | where two text runs share a line with no whitespace between them  |
| `panel.mjs`   | the facet panel's real painted gaps, top to bottom                |
| `rhythm.mjs`  | above-heading vs below-heading spacing, per group                 |
| `geo.mjs`     | whether a denied geolocation permission can be re-prompted        |
| `nearest.mjs` | what the heading and the offer say at each precision tier         |
| `hero.mjs`    | a cropped shot of the results header line                         |
| `bleed.mjs`   | whether a full-bleed box reaches the page's edges, and overshoots  |
| `cta.mjs`     | contrast of a control against an ANIMATED backdrop, worst frame   |
| `label.mjs`   | contrast of the label ON a control, per state, off painted glyphs |
| `share.mjs`   | the share control's fallback chain, one stubbed browser per rung  |
| `where.mjs`   | whether the country from /api/where moves the page or filters it  |
| `wordmark.mjs`| whether both marks still point at the board after a facet tick     |
| `first-paint.mjs` | what the render-blocking stylesheets cost first contentful paint |
| `css-parse.mjs` | what a stylesheet costs the main thread, transfer excluded       |
| `orbs.mjs`    | where the glow's hundred lights actually are, frame by frame     |
| `places.mjs`  | whether a list hangs its indent, per line box, at a given width   |
| `wrap.mjs`    | every element whose text wraps, and how ragged its lines are      |
| `wrap-diff.mjs` | two `wrap.mjs` snapshots side by side, better against worse     |
| `wordmark-gap.mjs` | the painted gap between the mark and JOBS, down the scroll  |
| `bars-contrast.mjs` | the headline's contrast over the bars, from the tunables   |
| `blocking-css.mjs`  | what one page's render-blocking stylesheets weigh          |

`wordmark.mjs` is the one that has to be a browser. The marks are served by the
`@header`/`@footer` slots, which do not re-render for the panel's pushState, so
the interesting states only exist after a real click on a real checkbox. It also
clicks the mark afterwards, because the attribute is not the answer: `next/link`
navigates to the href it was rendered with, not the one in the DOM, so an
address that reads correctly on hover can still land somewhere else. Stash the
fix and re-run it — steps 2 and 3 both report the stale board.

`where.mjs` holds the `/api/where` response until the listing has settled, so
the page can be read in the state it paints in and again once the refinement
lands. It sets `x-vercel-ip-country` per request, which is the only way to
stand in for Vercel's edge from in here, and the `nfj_country=all` cookie,
without which the proxy's country hop never lets the cleared state render at
all.

`first-paint.mjs` and `css-parse.mjs` are the pair that settled the glow. The
first loads a real page N times cold and reports FCP, optionally over a slow 4G
pipe and optionally with one sheet aborted, so the cost of a single stylesheet
is a subtraction rather than an argument. The second takes the transfer out
entirely -- it hands the sheet to a blank page as a `<style>` and stops the
clock once the engine has resolved it -- which is the number that does not move
when the network does. On localhost the first measures almost nothing but the
second; over 4G it is the other way round, and both were needed to say which
half of 785KB was hurting.

`orbs.mjs` reads the glow's lights through `translate`, not `transform`:
the drift is two individual transform properties on two elements -- the frame
and its `::before` -- and `transform` on both of them is still `none`. It
drives the animations to chosen times and reports the envelope, which is how the
top edge is held to TOP_CEILING in a real engine rather than only in a unit test.

`label.mjs` is `cta.mjs`'s other half. `cta.mjs` asks whether a control has an
edge against what is behind it; this asks whether the text on it can be read,
and it reads the answer off the painted glyphs rather than off the declared
colour pair, so antialiasing and the webfont are in the number. It takes states,
because a hover fill is a different colour pair — which is how the apply
button's label was found sitting at 4.32:1 on hover while resting at 4.79:1:

    node tools/probe/label.mjs URL .apply-button,.share-button rest,hover

`bleed.mjs` is the one that has to force a scrollbar. Headless Chromium uses
overlay scrollbars, which take no layout width, so `inline-size: 100vw` measures
correct in here and only overhangs on a desktop with classic scrollbars.
`scrollbar-gutter: stable` reserves the same strip unconditionally and
reproduces it — at 1280 with 15px reserved, the home masthead's band reads 1265
(the page box, no overhang) and the job hero's 100vw backdrop reads 1280, 15px
past the page and saved only by `.job-page`'s `overflow-x: clip`.

`cta.mjs` is the other one worth keeping. Its pixel reading lives in
`frame-pixels.mjs`, which is shared rather than inlined. A screenshot answers for one frame,
and the hero's backdrop is fifteen bars walking on loops of up to 254 seconds —
so it drives every time-based animation to a chosen `currentTime`, samples the
pixels around the control, and reports the best and worst frames rather than
whichever one the shutter caught. It takes a state:

    node tools/probe/cta.mjs URL .apply-button,.share-button 200 rest
    node tools/probe/cta.mjs URL .apply-button 120 hover
    PROBE_HIDE=.share-button node tools/probe/cta.mjs URL .apply-button 80 focus

`PROBE_HIDE` matters for focus: the outline sits 3px out from the box, so the
band the backdrop is read from otherwise lands on the next control's rim and
reports a neighbour as if it were the background.

`places.mjs` is the one that settles an indent argument. A list's element box is
a single rect spanning every line it wraps to, so it answers nothing about
either line — the reading has to come from a Range, whose client rects are one
per line box. `list-style-position: inside` puts the marker in the content box
as the first inline box of line one, so line two starts at the content edge, to
the LEFT of the marker; `outside` leaves the content box's inline start where it
is on every line. The test is therefore arithmetic, not a screenshot: line one's
x and line two's x are equal, or the item does not read as one item. It skips
`.visually-hidden` runs, which are clipped rather than removed and so still
report a line box nobody can see:

    node tools/probe/places.mjs http://localhost:3000/jobs/JR39786 390 .detail-places

`wrap.mjs` and `wrap-diff.mjs` are a pair, and the pair is the point. A
`text-wrap` change is not self-evidently an improvement: `balance` equalises
line widths but every engine caps it at a few lines and past that cap it does
nothing at all, while `pretty` only moves the LAST line and can leave the ones
above it more ragged than it found them. So the rule is measure, change, re-run
the identical sweep, keep what got better and revert what did not.

`wrap.mjs` sweeps three pages at 390px and 1280px and reports, per element that
actually wraps, its line count, the width of every line box, the raggedness
(the population standard deviation of those widths, over every line including
the last — which is the quantity `balance` minimises, so it is the one to score
against), and the number of words on the final line, which is the direct test of
whether a block ends on a stranded word. Candidates are the innermost block
container of a text run only; an ancestor would report its descendants' lines as
its own. `wrap-diff.mjs` matches two snapshots on page, width, selector and text
and prints the rows that moved, with a WORSE list at the bottom that is meant to
be acted on rather than read past:

    node tools/probe/wrap.mjs http://127.0.0.1:3103 /tmp/wrap-before.json
    # change the CSS, rebuild, restart
    node tools/probe/wrap.mjs http://127.0.0.1:3103 /tmp/wrap-after.json
    node tools/probe/wrap-diff.mjs /tmp/wrap-before.json /tmp/wrap-after.json

`wordmark-gap.mjs` reads painted edges, not layout boxes, and that distinction
is the bug it was written for: `scale` on the mark paints from the centre of a
box it does not resize, so the mark's painted right edge walks left while every
box in the row reports no movement. `offsetWidth` reports a constant across the
whole scroll and misses it entirely.

`bars-contrast.mjs` takes no browser at all. It reads `BAR_RGB`, `BAR_ALPHA` and
`BAR_COUNT` out of `_bars/bars-tunables.ts` and `--surface` / `--ink` out of
`(site)/job-shell.css`, composites N bars over the surface and prints the ratio.
It exists because that number rotted once: the comments said 6.28:1 for a long
while after `BAR_ALPHA` moved from 0.10 to 0.15, and it is a public
accessibility claim on /about.

`blocking-css.mjs` counts only `<link rel="stylesheet">` inside `<head>` of the
served document, which is deliberately not the import graph — Turbopack merges
and splits per route, and the glow's sheet is imported by a component that keeps
it off the critical path on purpose.

`sweep.mjs` is the one worth keeping around. Word separation delegated to a
margin or a flex gap is invisible on screen and wrong everywhere else — in the
accessible name, in copied text, and before the stylesheet lands. It walks the
DOM for runs that share a line box with no whitespace in the markup between
them, which is how the "Filters5 applied" family was found.
