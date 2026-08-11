/**
 * The words on /about, as data.
 *
 * Separated from the markup so the page component stays a layout and the copy
 * stays reviewable on its own -- and so about.test.tsx can assert the claims
 * against the numbers they came from rather than against a paragraph.
 *
 * Every figure here was measured. Where one moves, it moves here.
 */

/** The five claims, above everything else. */
export const HEADLINES = [
  {
    stat: "100%",
    claim: "test coverage",
    detail:
      "Lines, branches, functions and statements, on the web app and the crawler. The thresholds are set at 100, so the suite cannot run without them.",
  },
  {
    stat: "100",
    claim: "Lighthouse on desktop, all five categories",
    detail:
      "Performance, accessibility, best practices, SEO and agentic browsing, on all three pages. On mobile, four of the five hold at 100; performance runs 89 to 95, and the listing's 775ms country redirect is most of the gap.",
  },
  {
    stat: "0",
    claim: "migration required",
    detail:
      "Runs on Netflix's data and Netflix's platform. Postings keep the job code Netflix prints on them, and Apply goes to Netflix's own route.",
  },
  {
    stat: "480",
    claim: "roles, crawled on one command",
    detail:
      "The crawler enumerates the board, fetches every posting, resolves each location to a site, and invalidates exactly the pages that changed.",
  },
  {
    stat: "1",
    claim: "cache entry per URL",
    detail:
      "Every page is server-rendered and cached whole. The URL is the key, entries are built on first request, and two checksums decide what to throw away.",
  },
] as const;

export const SECTIONS = [
  {
    id: "cache",
    heading: "The URL is the cache key",
    body: [
      "Every filtered view of the board is a URL, and every URL holds finished markup. `/?country=US` and `/?country=US&level=senior` are two entries. The key is the parsed query, so two spellings of the same filters share one entry.",
      "Entries are built on the request that first asks for one. A URL nobody visits costs nothing, and the first visitor to a new one pays a derive over a board already in memory.",
      "The crawler computes two digests per posting: one over the fields the listing draws, one over everything a role's page renders. A rewritten description flushes that posting and leaves the other 479 alone. A crawl that finds 480 identical postings flushes nothing.",
    ],
  },
  {
    id: "filters",
    heading: "The filters carry the product",
    body: [
      "Tick Remote and every other group re-counts against it: United States falls from 304 to 99, Los Angeles from 132 to 7. Work type keeps its own totals, because the number beside an option is what clicking it does.",
      "A group shows five options and hides the rest behind a disclosure, which appears at three hidden items. The search box above the list appears on the same fact. Work type has two options and gets neither.",
      "Seniority sorts by rank — entry, mid, senior, staff, management — and sits last. Every other facet sorts by count. The URL carries all of it, so any view you can see is a link you can send.",
    ],
  },
  {
    id: "ultra",
    heading: "Ultra white, brighter than the page",
    body: [
      "The headline and every role title paint on a WebGPU rgba16float surface with extended tone mapping, masked to the letterforms. Values above 1.0 reach the display's headroom instead of clamping at reference white.",
      "The text under the mask is real. It sits in flow at `color: transparent`, so it defines the box and it is what you select, copy and hear. It gives up its ink only once the fill paints and the mask holds the words.",
      "Both headlines wrap, and SVG text does not, so the mask is built from the real text's own line boxes — a rect per character, grouped into lines, each baseline computed from the face's ascent and descent. Measured at 390px and 1280px: 0 glyph pixels missed.",
    ],
  },
  {
    id: "motion",
    heading: "Motion in CSS, paused when nobody is looking",
    body: [
      "The red bars and the footer glow are HTML elements on CSS keyframes, animating `translate` so a frame composites instead of reflowing. The masthead bars hold 60.2 fps on a software rasteriser with no GPU.",
      "An IntersectionObserver toggles one class and the stylesheets park the animation with `animation-play-state`. Scrolled to the bottom, the bars read paused and the glow reads running. Resuming continues from where it stopped.",
      "The masthead shrinks on a scroll-progress timeline: 73px at the top, 49px from 128px of scroll onward, then a compact bar for the rest of the document. No scroll listener, so the work stays on the compositor.",
    ],
  },
  {
    id: "access",
    heading: "Accessible on every page, not the audited ones",
    body: [
      "Walking the real tab order in Chromium finds 89 stops on the listing and 15 on a role page. Every one of them changes something on screen when it takes focus, measured by screenshot diff rather than by reading `outline` off the element.",
      "Colour never carries meaning alone. Selected facets are checked boxes, the sort control marks its choice with `aria-current`, and a focused row draws a frame. Four stylesheets hand those marks to system colours under forced colours.",
      "Contrast holds against the worst frame of the animation, not a typical one: 15 bars stacked on one pixel reach rgb(183, 8, 16), where the headline measures 6.28:1.",
    ],
  },
  {
    id: "built",
    heading: "What it is built on",
    body: [
      "TypeScript, Next.js 16, a Turborepo monorepo holding the web app and the crawler. Pages render on the server and the browser accelerates them: the listing paints from the server, fetches the board once, then filters, sorts and pages locally.",
      "HTML and CSS do the work. 26 of 143 source files ship JavaScript. `text-wrap: balance` evens the display type and `text-wrap: pretty` keeps a runt off the last line of running copy — in the layout engine, at every width.",
      "`llms.txt` tells an agent to fetch the board as one JSON document, documents every query parameter, and names the one field it will not find there.",
    ],
  },
] as const;

export const CLOSING =
  "There is more I want to add: saved searches and alerts, recommendations across the descriptions already in the database, and the crawler on a schedule. This is a starting point. I would welcome the opportunity to lead a team and build it out.";
