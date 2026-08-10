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

`cta.mjs` is the other one worth keeping. A screenshot answers for one frame,
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

`sweep.mjs` is the one worth keeping around. Word separation delegated to a
margin or a flex gap is invisible on screen and wrong everywhere else — in the
accessible name, in copied text, and before the stylesheet lands. It walks the
DOM for runs that share a line box with no whitespace in the markup between
them, which is how the "Filters5 applied" family was found.
