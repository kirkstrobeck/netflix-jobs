/**
 * The words on /about, as data.
 *
 * Separated from the markup so the page component is a layout and the copy can
 * be reviewed on its own. about.test.tsx asserts the claims here against the
 * numbers they came from.
 *
 * Every figure was measured. When one changes, it changes here.
 *
 * The page is five claims, then the groups, then the gift and the signature.
 * Nothing here speaks in the first person.
 */

/** The five claims, above everything else. */
export const HEADLINES = [
  {
    stat: "100%",
    claim: "test coverage",
    detail:
      "1,067 tests on the web app and 247 on the crawler. Statements, branches, functions and lines, all at 100%.",
  },
  {
    stat: "100",
    claim: "Lighthouse on desktop, all five categories",
    detail:
      "Performance, accessibility, best practices, SEO and agentic browsing, on all three pages. On mobile, four of the five are 100 and performance is 89 to 95.",
  },
  {
    stat: "60.2",
    claim: "fps on the animated masthead",
    detail:
      "The masthead bars and the footer glow are HTML elements animated by CSS keyframes. The page contains 0 video elements.",
  },
  {
    stat: "112",
    claim: "tab stops, all with a visible focus state",
    detail:
      "89 stops on the listing, 15 on a role page, 8 on this page. Each one changes the screen when it takes focus, measured by screenshot diff.",
  },
  {
    stat: "1",
    claim: "cache entry per URL",
    detail:
      "The parsed query is the cache key. Entries are created on the first request for that URL and flushed by checksum.",
  },
] as const;

export const GROUPS = [
  {
    id: "rendering",
    heading: "Rendering and caching",
    points: [
      "Every page renders on the server",
      "/about and the roles JSON prerender to static files at build time",
      "A role page prerenders its shell and streams the rest",
      "The parsed query is the cache key, so /?country=US and /?country=US&level=senior are two entries",
      "Two spellings of the same filters resolve to one entry",
      "Cache entries are created on the first request for that URL",
    ],
  },
  {
    id: "performance",
    heading: "Performance",
    points: [
      "Desktop Lighthouse: 100 for performance, accessibility, best practices, SEO and agentic browsing, on all three pages",
      "Mobile Lighthouse: 100 for accessibility, best practices, SEO and agentic browsing, on all three pages",
      "Mobile performance: 89 on the listing, 95 on a role page, 95 on this page",
      "Both runs use three passes per page and take the median score, against the deployed site",
      "Render-blocking CSS totals 46,244 bytes",
      "The masthead bars run at 60.2 fps",
    ],
  },
  {
    id: "testing",
    heading: "Test coverage",
    points: [
      "The web app: 1,067 tests covering 100% of statements, branches, functions and lines",
      "The crawler: 247 tests covering 100% of statements, branches, functions and lines",
      "Coverage thresholds are set to 100, so the suite fails below that",
    ],
  },
  {
    id: "filtering",
    heading: "Filtering",
    points: [
      "Six facets: work type, keywords, location, team, business unit and seniority",
      "Each group shows five options and hides the rest behind a disclosure, which appears at three or more hidden options",
      "The option search appears only in groups that hide options, so work type's two rows get neither control",
      "Seniority sorts by rank, entry through management, and appears last",
      "Every other facet sorts by count, largest first",
      "Filters apply across groups: select Remote and United States goes from 302 to 98, Los Angeles from 131 to 7",
      "A group keeps its own totals, so an unselected option shows how many roles selecting it returns",
      "Active filters appear in the URL, so every view of the listing is a link",
    ],
  },
  {
    id: "location",
    heading: "Location",
    points: [
      "All 479 active roles resolve to a site record",
      "The 479 roles resolve to 684 location links",
      "31 of the 36 sites carry coordinates; the 5 without them are the remote sites",
      "383 roles resolve to at least one site with coordinates",
      "Nearest sorts by distance from browser geolocation, computed in the browser",
      "The server reads the visitor's country from an IP header and puts it in the URL as a filter",
      "A role open in more than one place lists one location per line",
    ],
  },
  {
    id: "craft",
    heading: "Craft",
    points: [
      "Headlines and role titles paint on a WebGPU rgba16float surface with extended tone mapping, above SDR reference white",
      "The mask covers every glyph: 0 glyph pixels missed, at 390px and at 1280px",
      "The text under the mask stays selectable and readable by a screen reader",
      "The masthead bars and the footer glow are HTML elements animated by CSS keyframes; the page contains 0 video elements",
      "Both effects pause while they are off screen and resume where they stopped",
      "The masthead shows 73px at the top of the page and 49px after 128px of scroll, driven by a scroll-progress timeline",
      "text-wrap: balance sets the display type and text-wrap: pretty sets the running copy, so no line ends on a single stranded word",
      "Posted dates render as a full date on the server and change to '3 days ago' in the browser",
      "Share opens the operating system's share sheet, and copies the link where there is no sheet",
      "The share preview image returns HTTP 200, image/jpeg, 244,928 bytes, cached for a year as immutable",
    ],
  },
  {
    id: "accessibility",
    heading: "Accessibility",
    points: [
      "Tab order walked in Chromium: 89 stops on the listing, 15 on a role page, 8 on this page",
      "All 112 stops change the screen when they take focus, measured by screenshot diff",
      "A headline over the bars measures 5.10:1 against the darkest frame the animation can reach",
      "The Apply label measures 4.79:1 at rest and 5.91:1 on hover; Share measures 18.89:1 and 16.38:1",
      "Selected facets are checked boxes and the sort control marks its choice with aria-current",
      "Four stylesheets map focus and selection to system colours under forced colours",
      "Locations, results and pagination are marked up as lists, so a screen reader announces the number of items in each",
    ],
  },
] as const;

/** The page's own title. Rendered below the masthead, not inside it. */
export const TITLE = "About this project";

/** The one statement on the page that is not a measurement. */
export const GIFT = "This project is a gift to Netflix.";

/** The last line, and the only place a name appears. */
export const SIGNATURE = "Kirk Strobeck";

/**
 * Resolved rather than assumed: the personal domain answers 302 to this exact
 * address, on both the apex and www.
 */
export const LINKEDIN = {
  href: "https://www.linkedin.com/in/kirkstrobeck/",
  label: "linkedin.com/in/kirkstrobeck",
};
