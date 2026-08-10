import { describe, expect, it } from "vitest";

import { cacheHeaders } from "./cache-headers";
import config from "./next.config";

// The config is the one place where behaviour is declared rather than written,
// so nothing in the suite would notice a value going missing from it. These are
// the entries that have a reason attached in the file itself.

describe("next.config", () => {
  it("wires the HTTP policy to the list cache-headers builds", () => {
    expect(config.headers).toBe(cacheHeaders);
  });

  // Invalidation is the mechanism -- the ingestor POSTs /api/revalidate -- so
  // these numbers are only the backstop for the crawl that never called.
  it("keeps the cache profile long, and the client half of it bounded", () => {
    expect(config.cacheLife?.jobs).toEqual({
      stale: 60 * 60,
      revalidate: 60 * 60 * 24 * 7,
      expire: 60 * 60 * 24 * 30,
    });
  });

  it("turns on the cache primitives the pages hold their renders in", () => {
    expect(config.cacheComponents).toBe(true);
  });

  it("does not announce the framework, and does compress", () => {
    expect(config.poweredByHeader).toBe(false);
    expect(config.compress).toBe(true);
  });

  it("serves modern image formats and caches them for a year", () => {
    expect(config.images?.formats).toEqual(["image/avif", "image/webp"]);
    expect(config.images?.minimumCacheTTL).toBe(31536000);
  });

  it("roots turbopack at the workspace, not the app", () => {
    expect(config.turbopack?.root?.endsWith("/apps/web")).toBe(false);
  });
});

// The listing moved from /jobs to the home page. A config redirect answers
// before any rendering, and needs no route that reads searchParams.
describe("the /jobs redirect", () => {
  it("sends the old listing path to the home page, permanently", async () => {
    expect(await config.redirects!()).toEqual([
      { source: "/jobs", destination: "/", permanent: true },
    ]);
  });

  // `source: "/jobs"` matches that one segment exactly, so a posting is not
  // swallowed by the redirect that retired the listing above it.
  it("leaves a posting under /jobs/<id> alone", async () => {
    const sources = (await config.redirects!()).map((rule) => rule.source);

    expect(sources).not.toContain("/jobs/:path*");
    expect(sources.every((source) => !source.includes(":"))).toBe(true);
  });
});
