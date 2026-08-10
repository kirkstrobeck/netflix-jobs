import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cacheHeaders } from "./cache-headers";

// The HTTP policy this app ships, which lives outside src/ because next.config.ts
// reads it -- and which is the one file where a wrong answer is invisible in
// every test that renders a component and fatal in a browser.

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

async function production(): Promise<Rule[]> {
  vi.stubEnv("NODE_ENV", "production");

  return (await cacheHeaders()) as Rule[];
}

const valueOf = (rule: Rule, key: string) =>
  rule.headers.find((header) => header.key === key)?.value;

const ruleFor = (rules: Rule[], source: string) =>
  rules.find((rule) => rule.source === source);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cacheHeaders", () => {
  // Dev asset URLs are not content-hashed, so a cacheable policy on a stable URL
  // is how a saved edit stops reaching the browser. The empty list is the fix.
  it("caches nothing outside production", async () => {
    expect(await cacheHeaders()).toEqual([]);
  });

  it("gives the board payload a year, because the ?v= addresses its content", async () => {
    const rule = ruleFor(await production(), "/api/board");

    expect(valueOf(rule!, "Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  // Next's appendHeader stores even a single value as an ARRAY, and next start's
  // gzip middleware skips anything whose Content-Type is not a string -- so this
  // duplicate, declared here as a plain string before the handler runs, is what
  // gets the 143KB board compressed to 15KB.
  it("states the board's content type here so the response is compressed", async () => {
    const rule = ruleFor(await production(), "/api/board");

    expect(valueOf(rule!, "Content-Type")).toBe("application/json; charset=utf-8");
  });

  it("puts the board rule before the catch-all that would otherwise swallow it", async () => {
    const rules = await production();
    const catchAll = rules.findIndex((rule) => rule.source.includes("_next/"));

    expect(rules.findIndex((rule) => rule.source === "/api/board")).toBeLessThan(catchAll);
  });

  it("gives documents a minute at the edge and a day of stale-while-revalidate", async () => {
    const rules = await production();
    const rule = rules.find((r) => r.source.includes("_next/"));

    expect(valueOf(rule!, "Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=86400",
    );
  });

  it("keeps fonts and hashed media immutable", async () => {
    const rules = await production();

    for (const source of ["/fonts/:path*"]) {
      expect(valueOf(ruleFor(rules, source)!, "Cache-Control")).toBe(
        "public, max-age=31536000, immutable",
      );
    }

    const media = rules.find((rule) => rule.source.includes("woff2"));

    expect(valueOf(media!, "Cache-Control")).toBe("public, max-age=31536000, immutable");
  });
});

// THE CATCH-ALL'S PATTERN, READ AS A PATTERN.
//
// Three separate outages have been spelled into this one string, and none of
// them is visible from the value it carries. So it is exercised as the regex
// path-to-regexp will build from it, against the URLs that each mistake broke.
describe("the document rule's source pattern", () => {
  // Compiled by the SAME matcher Next compiles a `source` with, so what is under
  // test is the pattern rather than a second reading of it written here.
  const matches = async (pathname: string) => {
    const rules = await production();
    const rule = rules.find((r) => r.source.includes("_next/"))!;

    return pathToRegexp(rule.source).test(pathname);
  };

  // A 60-second policy here replaced the year-long immutable one Next already
  // serves for content-hashed chunks -- the opposite of the intent.
  it("leaves the hashed chunks under /_next/static alone", async () => {
    expect(await matches("/_next/static/chunks/1yt_yhhyb219z.css")).toBe(false);
  });

  // /api/revalidate is a POST lever, not a document.
  it("leaves the API routes alone", async () => {
    expect(await matches("/api/revalidate")).toBe(false);
  });

  // `.+` rather than `.*`: every listing URL has the pathname `/` -- country,
  // facets and page are all query -- so that one character is the whole listing,
  // and Next discards this list on a postponed PPR resume anyway.
  it("leaves the listing itself alone", async () => {
    expect(await matches("/")).toBe(false);
  });

  it("still covers a posting, which prerenders per path", async () => {
    expect(await matches("/jobs/JR00001")).toBe(true);
  });
});
