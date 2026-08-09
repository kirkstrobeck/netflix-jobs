import type { NextConfig } from "next";

type HeaderList = Awaited<ReturnType<NonNullable<NextConfig["headers"]>>>;

const immutable = [
  {
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
  },
];

// The same content type the route handler sets, stated again here, and the
// duplication is load-bearing rather than sloppy.
//
// Next appends a route handler's own headers with appendHeader, which stores
// even a single value as an ARRAY. next start's gzip middleware asks
// compressible() whether res.getHeader("Content-Type") is worth compressing,
// and compressible() rejects anything that is not a string -- so every route
// handler response goes out uncompressed. Measured: 143,495 bytes for the board
// against 14,704 gzipped.
//
// A header declared here is set as a plain string BEFORE the handler runs, and
// sendResponse then skips the handler's copy because the name is already
// present. Same value, one string, and the middleware compresses it.
//
// The handler keeps its own copy so the response is still correctly typed in
// dev, where this whole function returns nothing.
const boardType = [
  {
    key: "Content-Type",
    value: "application/json; charset=utf-8",
  },
];

const html = [
  {
    key: "Cache-Control",
    value: "public, s-maxage=60, stale-while-revalidate=86400",
  },
];

export async function cacheHeaders(): Promise<HeaderList> {
  // Nothing cacheable in dev. Dev asset URLs are not content-hashed -- the
  // stylesheet stays apps_web_src_app_(site)_1jkber4._.css across every edit --
  // so a cacheable policy on a stable URL is precisely how a saved change stops
  // reaching the browser. stale-while-revalidate=86400 is the sharp end: the
  // browser is entitled to paint the day-old copy and revalidate afterwards, so
  // a reload shows the OLD page and the fix "doesn't come through" even though
  // the server recompiled it correctly.
  if (process.env.NODE_ENV !== "production") {
    return [];
  }

  return [
    // The board payload, which is content-addressed by the ?v= the listing
    // appends, so it gets the same year-long policy as a hashed asset. It has to
    // be stated BEFORE the catch-all and excluded from it: a 60-second s-maxage
    // on the one file the client filtering depends on would put a round trip
    // back in front of the interaction this whole thing exists to remove.
    {
      source: "/api/board",
      headers: [...immutable, ...boardType],
    },
    // Not /:path* -- that also swallowed /_next/static, whose URLs Next DOES
    // content-hash in a production build and already serves as immutable.
    // Matching them here replaced a one-year immutable policy with a 60-second
    // one, which is the opposite of the intent. api/ is excluded for the same
    // reason in the other direction: /api/revalidate is a POST lever, not a
    // document, and nothing about it should be cacheable.
    //
    // `.+` rather than `.*`, so the LISTING is not matched. That one character
    // is the whole of the country's cache story, and it is deliberate:
    //
    // The listing is rendered for one country -- the one in the URL, the one in
    // the cookie, or the one the edge read off the address -- and the last two
    // are not in the URL. A shared cache keys on the URL, so `s-maxage=60` here
    // hands a visitor in Seoul the document built a moment earlier for a
    // visitor in Los Gatos. `Vary: Cookie, X-Vercel-IP-Country` is the textbook
    // answer and it does not work: Next sets its own Vary (rsc,
    // next-router-state-tree, ...) on every app-router response, overwriting
    // both a header declared here and one appended in proxy.ts -- verified
    // against `next start`, which returns Next's list either way. The docs say
    // as much, and say the fix is to move cache-affecting inputs into the
    // pathname (02-guides/cdn-caching.md).
    //
    // So the listing is left to the header Next sets for it, which is already
    // right: `private, no-cache, no-store, max-age=0, must-revalidate`, because
    // the route reads cookies and headers. Overriding that with a public policy
    // was the bug. What is expensive is cached elsewhere and unaffected -- the
    // 108KB board is immutable under /api/board, the chunks are immutable under
    // /_next/static -- so what this costs is one dynamic HTML render per visit,
    // which is what "the listing varies by country" means.
    {
      source: "/:path((?!_next/|api/).+)",
      headers: html,
    },
    {
      source: "/fonts/:path*",
      headers: immutable,
    },
    {
      source:
        "/:path(.*)\\.(ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|otf|mp4|webm|mov)",
      headers: immutable,
    },
  ];
}
