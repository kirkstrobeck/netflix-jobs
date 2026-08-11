import path from "node:path";

import type { NextConfig } from "next";

import { cacheHeaders } from "./cache-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The job data changes exactly when the ingestor runs, and the ingestor tells
  // us it ran (POST /api/revalidate -> revalidateTag). So invalidation is the
  // mechanism and these numbers are only the backstop for the case where that
  // call never arrives -- a crawl that died, a secret that was rotated, a web
  // process that was not up. A short time-based revalidate would spend a
  // Supabase round trip per period forever to catch a thing that almost never
  // happens.
  //
  // stale is the one number NOT stretched to days. It governs the client router
  // cache, which revalidateTag from a route handler cannot reach -- only a
  // Server Action clears it -- so a tab left open holds pre-invalidation HTML
  // for this long no matter what the server does. An hour is 12x the 5-minute
  // default and still bounded.
  cacheLife: {
    jobs: {
      stale: 60 * 60, // 1 hour on the client router
      revalidate: 60 * 60 * 24 * 7, // 7 days before the server refreshes unasked
      expire: 60 * 60 * 24 * 30, // 30 days before a read has to block on Supabase
    },
  },
  // Dev server binds 0.0.0.0 inside Colima; Chrome on http://127.0.0.1:3000
  // is cross-origin vs that hostname and HMR is blocked without this.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  poweredByHeader: false,
  compress: true,
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  // Deliberately NO watchOptions.pollIntervalMs. It is the documented knob for
  // exactly this situation ("if the native file watching doesn't work (e.g.
  // docker)"), and it does work -- but Turbopack polls from `root` above, which
  // is the monorepo root: 20,713 files instead of the 71 under apps/web/src. A
  // stat pass over that tree costs 2.5-12s on virtiofs, so the poll interval
  // stops being the binding constraint. Measured on this container, same edit,
  // same file: native watcher 91ms, pollIntervalMs 400 -> 15,400ms.
  //
  // So the native watcher stays, and the thing it cannot see -- a Mac save,
  // which crosses virtiofs without producing a guest inotify event -- is handled
  // by tools/sandbox/mac-save-bridge.mjs, which polls only src (41-100ms/pass)
  // and rewrites the changed file in place so the native watcher gets a real
  // MODIFY. Fast path stays fast; the 290x cheaper tree is the one being polled.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  headers: cacheHeaders,
  // The listing moved from /jobs to the home page. A config redirect rather than
  // a page that calls permanentRedirect(): it answers before any rendering, and
  // it does not need a route that reads searchParams -- which under Cache
  // Components would have to be wrapped in <Suspense> just to be thrown away.
  //
  // Query values are passed through to the destination automatically, so a
  // shared /jobs?team=Engineering&page=3 lands on the same results at /.
  // `permanent` is a 308, which keeps the method and tells crawlers it moved.
  //
  // /jobs/[jobid] is untouched: the source matches that one segment exactly.
  redirects: async () => [{ source: "/jobs", destination: "/", permanent: true }],
  // THE MISSING HALF OF THE ROOT LAYOUT'S DECISION.
  //
  // Streaming metadata (03-api-reference/04-functions/generate-metadata.md,
  // "Streaming metadata") sends the UI first and APPENDS the metadata tags to
  // `<body>` when they resolve at request time. Under Cache Components that
  // applies to any route whose render defers -- "metadata streams in with other
  // deferred content" -- which is the listing, because searchParams is
  // request-time. Measured on the built output: the listing closed `</head>` at
  // byte 1750 and then put `<title>` at 30878 and `<meta name="description">`
  // at 30917, in the body, reaching the head only if React's runtime hoists
  // them. Lighthouse scored `meta-description` 0 and the listing's SEO 0.910.
  //
  // `/.*/ ` is the documented way to turn it off wholesale
  // (05-config/01-next-config-js/htmlLimitedBots.md, "Disabling"). The doc's
  // caution is that blocking metadata costs response time -- but this app has
  // already spent that. The root layout wraps `<body>` in
  // `<Suspense fallback={null}>` precisely so there is no static shell and
  // "every request blocks until the page is fully rendered"; nothing below it
  // suspends. Streaming the metadata out of a document that is not otherwise
  // streamed bought nothing and cost a head. This is that decision finished,
  // not a new one.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
