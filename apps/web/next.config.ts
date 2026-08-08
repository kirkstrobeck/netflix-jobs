import path from "node:path";

import type { NextConfig } from "next";

import { cacheHeaders } from "./cache-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
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
};

export default nextConfig;
