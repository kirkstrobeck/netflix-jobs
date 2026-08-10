# A careers board that costs nothing to adopt

**This works with Netflix's existing data and their existing platform. No
migration required.** Nothing moves, nothing is re-keyed, there is no new system
of record. The postings are crawled from Netflix's own board, keep the job code
Netflix prints on them as their URL key, and send every applicant back to
Netflix's own apply route. Turn this off and the board is exactly where it was.

What that buys, measured on the deployed site on 2026-08-10 with Lighthouse,
3 runs per page, median score, desktop simulated:

| | Performance | Accessibility | Best practices | SEO | Agentic browsing |
| --- | --- | --- | --- | --- | --- |
| Listing `/` | 100 | 100 | 100 | 100 | 100 |
| Role `/jobs/JR41714` | 100 | 100 | 100 | 100 | 100 |

And 100% line, branch, function and statement coverage on both packages: 1,042
tests over the web app, 247 over the ingestor, with the thresholds set at 100 so
the suite cannot be run without them.

Those are the headline numbers. The rest of this is what they are made of.

## The whole URL is the cache key

Every filtered view of the board is a URL, and every URL is its own cache entry
holding finished markup. `/?country=US` and `/?country=US&level=senior` are two
entries. The key is the *parsed* query, so `?country=us&team=Engineering` and
`?team=Engineering&country=US` are one entry rather than two copies of one
screen.

Entries are built lazily, on the first request that asks for one. There is no
enumeration of combinations and no build step that tries to guess them: a URL
nobody visits costs nothing, and the first visitor to a new one pays a derive
over a board already in memory, with no database round trip. A warm entry is
finished bytes.

Invalidation is two checksums per posting, computed by the crawler:

- **board checksum** covers the fields the listing draws.
- **content checksum** covers everything a role's own page renders.

A rewritten job description moves the content checksum, flushes that one
posting's page, and leaves the listing and the other 479 postings exactly where
they were. A crawl that re-fetched 480 identical postings fires nothing at all.
The listing is only thrown away when the set it draws has genuinely moved — a
role added, removed, or changed in a field the listing shows.

This is also why the caching survives being wrong. A tag is a claim, and each
claim is checked against a digest rather than asserted on a timer.

## The filters carry real logic

The facet panel is where most of the product thinking went, and almost none of
it is visible until you look for it.

**Filters respect each other, across the whole board.** Tick Remote and every
other group re-counts against it: United States drops from 304 to 99, Los Angeles
from 132 to 7. But the work type group itself keeps its own unfiltered counts —
Onsite 205, Remote 99 — because the number beside an option is what *clicking it*
does. A ticked filter that zeroed its own siblings would leave you able to narrow
and never widen.

**Controls appear only when they have work to do.** A group shows its top five
options. The rest go behind a disclosure — but only when at least three are
hidden, because a control that hides one row is bigger than the row it hides. The
search box above the list turns on the same fact: a list already entirely on
screen has nothing to search. Both read the same function, so they cannot
disagree about whether a group is holding anything back. Work type has two
options and gets neither control.

**Ordinal and nominal facets sort differently.** Seniority is a ladder, so it
sorts by rank — entry, mid, senior, staff, management — and sits last in the
panel. Every other facet is nominal: Canada is not more or less than Poland, so
they sort count-descending, biggest answers first, with the label breaking ties
so equal counts never shuffle between renders.

**The URL always mirrors the active facets.** `/?type=Remote&team=Engineering&page=2`
is the state, so any view you can see is a link you can send. Requesting that URL
with no JavaScript returns all 20 rows of the page and the sentence "Showing 1
thru 20 of 99 roles" already rendered.

## Every role knows where it is

All 480 active roles resolve to a site record. 31 of the 36 sites carry
coordinates; the five that do not are the five remote ones, which correctly have
no point on a map.

Nearest works two ways, and they are deliberately separate:

- **Browser geolocation**, asked for only when the visitor presses Nearest, used
  entirely in the browser. A coordinate never reaches the server and so can never
  reach a shared cache entry.
- **IP country**, from Vercel's `x-vercel-ip-country` header, resolved into the
  query before rendering — so the country the server detected is a filter in the
  URL like any other, not a hidden input that makes one visitor's cached page
  wrong for the next.

## The headline is brighter than white

The site headline and every role title are painted on a WebGPU `rgba16float`
surface with extended tone mapping, where values above 1.0 reach the display's
headroom instead of clamping at reference white — then masked to the
letterforms. Ultra dark mode: the type is brighter than the brightest white the
page can otherwise produce.

There is no CSS substitute. `background-clip: text` with an HDR colour clamps,
and SVG text filled with `color-hdr()` was built and compared side by side at the
same headroom and read as plain SDR white.

The text under the mask is real. It sits in flow at `color: transparent`, so it
still defines the box, and it is what you select, copy and hear. It gives up its
ink only once the fill is confirmed painting *and* the mask has the words in it —
so no WebGPU, no adapter, or a mask not yet measured all leave an ordinary white
heading rather than an invisible one.

Both headlines wrap, and SVG text does not. The mask is built from the real
text's own line boxes: a rect per character, grouped into lines, each line's
baseline computed from the line box and the face's own ascent and descent.
Measured in Chromium at 390px and 1280px, on the one-line and two-line masthead
and a three-line role title: **0 glyph pixels missed by the mask**, coverage
1.0000 in all four readings.

## The motion is CSS, not a video

The red bars behind the mastheads and the glow at the foot of the page are HTML
elements driven by CSS keyframes. There is no video: the deployed page contains
zero `<video>` elements.

They animate `transform: translate3d(...)` and the `translate` property — not
`left`, not `top`, not by moving elements through layout — so a frame is a
composite, not a reflow. Measured against the deployed site in headless Chromium
on this machine's software renderer, with no GPU: the masthead bars ran **60.2
fps** on the listing and 60.1 fps on a role page. The 100-orb footer glow ran
10.3 fps under that same software rasteriser.

**Off screen, they stop.** An IntersectionObserver toggles one class, and the
stylesheets do the rest with `animation-play-state`. Measured on the deployed
site: at the top of the page the bars read `running` and the glow reads `paused`;
scrolled to the bottom, the bars read `paused` and the glow reads `running`. One
class mutation, no keyframes rebuilt, and a resumed animation carries on from
where it stopped. The same switch also parks everything when the tab goes to the
background.

The overscroll gutter is handled the same way — with no JavaScript at all. A
scroll-progress timeline on the root element holds black across the entire scroll
range and swaps to the footer's own red only at 100%, so rubber-banding past the
end of the page shows the red the footer ends in, and rubber-banding past the top
shows black. It adds no scrollable height; it is one colour on an element that
already existed.

## HTML and CSS first, JavaScript in small islands

26 of the 143 source files are client components. The several hundred animated
elements behind both effects are server-rendered; the only thing that ships
JavaScript for them is a wrapper that knows when it is idle.

The CSS is current: `:has()`, container query units, `color-mix()`,
`text-wrap: balance`, `animation-timeline: scroll()`, CSS masks, and
`dynamic-range-limit` for the Ultra fill. Where a browser lacks one, the feature
is behind `@supports` and the page falls through to something correct rather than
something broken.

## Accessibility, on every page rather than the audited ones

I walked the actual tab order in Chromium rather than querying for focusable
selectors, and measured each stop by full-viewport screenshot diff — focused
versus blurred — because two controls here deliberately draw their focus mark
somewhere other than the focused element.

- **Listing: 89 tab stops.** Skip link, wordmark, both sort options, 20 role
  links, 5 pagination links, clear-filters, 46 facet checkboxes, 3 facet search
  boxes, the keyword Add button, 3 disclosure summaries, 4 footer links.
- **Role page: 15 tab stops.** Skip link, wordmark, Apply, Share, two in-body
  links, 4 detail links, 4 footer links.
- **Stops with no visible change on focus: 0.** On both pages.

That zero is the interesting part. A result row takes `outline: none` on its link
and lights a 2px frame around the whole row instead; a detail link drops its
outline and thickens its underline. Both look ringless if you read `outline` off
the focused element, and both are plainly visible on screen — which is why the
measurement is pixels.

Colour is never the only carrier. Selected facets are checkboxes, checked; the
sort control marks the active option with `aria-current`; the row focus mark is a
frame appearing, not a hue shifting. Four stylesheets carry `forced-colors`
blocks that hand those marks to system colours when the user's own palette
replaces ours.

Contrast is held against the worst frame of the animation rather than a typical
one. The bars are flat-alpha layers, so the darkest a stack can make the backdrop
is all 15 over the same pixel: the ceiling is `rgb(183, 8, 16)`, against which
the headline measures 6.28:1. Both call-to-action labels were read off painted
pixels in a browser — Apply 4.79:1 at rest and 5.91:1 on hover, Share 18.89:1 and
16.38:1 — and the hover rule deepens the primary's fill rather than lightening it
precisely because lightening it moved the white label to 4.32:1, under AA, in the
state the label is being read in.

Lighthouse accessibility 100 is the floor here, not the proof.

## The small things that make it feel finished

- **Native share on role pages.** `navigator.share()` gets the operating
  system's own sheet where it exists, with a copy-link fallback that does not
  depend on guessing support during hydration.
- **Time-ago on posted dates.** The server renders the absolute date, so the
  HTML is correct and cacheable; the browser swaps it to "3 days ago" and keeps
  the full date in `title` and in the `<time>` element's `datetime`.
- **Share previews that unfurl.** `og:image` points at `/share-preview.jpg` on
  the deployed origin, absolute as the property requires. Live now: HTTP/2 200,
  `image/jpeg`, 244,928 bytes, `cache-control: public, max-age=31536000,
  immutable`.
- **`llms.txt`, for agents.** Served at `/llms.txt`, HTTP 200, `text/plain`. It
  tells an agent to fetch the board as one JSON document instead of crawling the
  listing, documents every query parameter, and says which field it will not
  find there.

## What it is built on

TypeScript throughout, Next.js 16.2.12, a Turborepo monorepo of a web app and a
crawler. Everything is server-rendered first, with client-side acceleration on
top: the listing paints from the server, then fetches the board once and filters,
sorts and pages in the browser against it — so the first response is complete and
every interaction after it is local.
