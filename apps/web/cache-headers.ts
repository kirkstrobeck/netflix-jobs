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
    // `.+` rather than `.*`, so the LISTING is not matched. Every listing URL
    // has the pathname `/` -- country, facets and page are all query -- so that
    // one character is the whole listing, and it stays.
    //
    // THE REASON CHANGED. THE ANSWER DID NOT.
    //
    // It used to be about the country. The listing was rendered for one country
    // that could arrive from the cookie or from the address the edge read off
    // the request, and neither is in the URL a shared cache keys on, so
    // `s-maxage=60` here would hand a visitor in Seoul the document built a
    // moment earlier for a visitor in Los Gatos. `Vary: Cookie,
    // X-Vercel-IP-Country` is the textbook answer and does not work: Next sets
    // its own Vary on every app-router response and overwrites both a header
    // declared here and one appended in proxy.ts. The docs say the fix is to
    // move cache-affecting inputs into the URL (02-guides/cdn-caching.md).
    //
    // That fix has now been made. proxy.ts settles the country BEFORE the
    // render and redirects to the URL that names it, so JobListing reads
    // searchParams and nothing else and two visitors on one URL get the same
    // bytes. The render is measurably cheaper for it: `/` moved from ƒ
    // (dynamic) to ◐ (partial prerender) in the build output the moment
    // cookies() and headers() left it, so the masthead, the shell and the font
    // preloads come off the prerender instead of being rebuilt per request.
    //
    // The HTTP policy still cannot follow, and the reason is now Next's rather
    // than ours. `/` resolves its dynamic hole per request, so it goes out as a
    // postponed PPR resume -- `x-nextjs-postponed: 1` -- and Next serves those
    // with `private, no-cache, no-store, max-age=0, must-revalidate` AND
    // discards this entire header list on the way. Measured against `next start`
    // 16.2.12: a probe header on a source that certainly matches `/` (the
    // pattern below with `.*` in place of `.+`) does not appear on `/` at all,
    // while the same list lands on /jobs/[jobid], which prerenders per path and
    // does not postpone. So this is not a `.+`/`.*` choice any more; there is no
    // spelling of it that wins.
    //
    // What is expensive is cached elsewhere and unaffected -- the 108KB board is
    // immutable under /api/board, the chunks are immutable under /_next/static
    // -- so what is left to pay is the listing hole, streamed into a shell that
    // no longer costs anything.
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
