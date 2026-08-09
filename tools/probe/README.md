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
| `cta.mjs`     | contrast of a control against an ANIMATED backdrop, worst frame   |
| `share.mjs`   | the share control's fallback chain, one stubbed browser per rung  |
| `where.mjs`   | whether the country from /api/where moves the page or filters it  |

`where.mjs` holds the `/api/where` response until the listing has settled, so
the page can be read in the state it paints in and again once the refinement
lands. It sets `x-vercel-ip-country` per request, which is the only way to
stand in for Vercel's edge from in here, and the `nfj_country=all` cookie,
without which the proxy's country hop never lets the cleared state render at
all.

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
