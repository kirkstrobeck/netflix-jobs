import type { NextConfig } from "next";

type HeaderList = Awaited<ReturnType<NonNullable<NextConfig["headers"]>>>;

const immutable = [
  {
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
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
      headers: immutable,
    },
    // Not /:path* -- that also swallowed /_next/static, whose URLs Next DOES
    // content-hash in a production build and already serves as immutable.
    // Matching them here replaced a one-year immutable policy with a 60-second
    // one, which is the opposite of the intent. api/ is excluded for the same
    // reason in the other direction: /api/revalidate is a POST lever, not a
    // document, and nothing about it should be cacheable.
    {
      source: "/:path((?!_next/|api/).*)",
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
