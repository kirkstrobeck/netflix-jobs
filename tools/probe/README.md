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

`sweep.mjs` is the one worth keeping around. Word separation delegated to a
margin or a flex gap is invisible on screen and wrong everywhere else — in the
accessible name, in copied text, and before the stylesheet lands. It walks the
DOM for runs that share a line box with no whitespace in the markup between
them, which is how the "Filters5 applied" family was found.
