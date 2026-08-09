import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "@/proxy";

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: "next" })),
    redirect: vi.fn((url: unknown, init: unknown) => ({ type: "redirect", url, init })),
  },
}));

type Request = { path: string; search?: string; cookie?: string; geo?: string };

function makeRequest({ path, search = "", cookie, geo }: Request): NextRequest {
  const target = { pathname: path, search };

  return {
    nextUrl: {
      pathname: path,
      searchParams: new URLSearchParams(search),
      clone: () => target,
    },
    cookies: { get: (name: string) => (cookie && name ? { value: cookie } : undefined) },
    headers: { get: () => geo ?? null },
  } as unknown as NextRequest;
}

// Every case below states its own country signal, so the localhost stand-in
// must not answer for the ones that mean to say nothing.
beforeEach(() => {
  process.env.DEV_GEO_COUNTRY = "none";
});

afterEach(() => {
  delete process.env.DEV_GEO_COUNTRY;
  vi.mocked(NextResponse.redirect).mockClear();
  vi.mocked(NextResponse.next).mockClear();
});

describe("canonical casing", () => {
  it("passes an already-canonical path through", () => {
    const result = proxy(makeRequest({ path: "/jobs/JR41912" }));

    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ type: "next" });
  });

  it("redirects a mis-cased path to the canonical form", () => {
    proxy(makeRequest({ path: "/Jobs/jr41912", search: "?x=1" }));

    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/jobs/JR41912", search: "?x=1" }),
      308,
    );
  });

  it("exposes a matcher config", () => {
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
  });
});

/**
 * The country lands in the address bar before the listing exists.
 *
 * countryDefault and countryRedirect are pinned on their own; what is pinned
 * here is that the proxy actually issues the hop, on the right path, with the
 * right status, and tells shared caches to keep out of it.
 */
describe("the country hop", () => {
  const target = (call: number = 0) =>
    vi.mocked(NextResponse.redirect).mock.calls[call]![0] as unknown as {
      search: string;
    };

  it("sends a bare listing to the country the edge matched", () => {
    proxy(makeRequest({ path: "/", geo: "JP" }));

    expect(target().search).toBe("?country=JP");
  });

  // 307, not 308. The destination depends on where the request came from, so a
  // permanent redirect would have a browser remember one visitor's country as
  // the meaning of `/`, and a crawler record it as the home page's new address.
  it("is temporary, and private to this visitor", () => {
    proxy(makeRequest({ path: "/", geo: "JP" }));

    expect(NextResponse.redirect).toHaveBeenCalledWith(expect.anything(), {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  });

  it("prefers the cookie over the address", () => {
    proxy(makeRequest({ path: "/", cookie: "CA", geo: "JP" }));

    expect(target().search).toBe("?country=CA");
  });

  it("leaves a URL that already names a country alone", () => {
    const result = proxy(makeRequest({ path: "/", search: "?country=US", geo: "JP" }));

    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ type: "next" });
  });

  it("does not hop when no country is owed", () => {
    const result = proxy(makeRequest({ path: "/" }));

    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ type: "next" });
  });

  // A posting is one role at one address. There is no country to apply to it,
  // so a visitor opening a shared job link is never bounced first.
  it("never touches a job posting", () => {
    const result = proxy(makeRequest({ path: "/jobs/JR41912", geo: "JP" }));

    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ type: "next" });
  });

  // Casing first, country second, and never both in one response: the mis-cased
  // URL is not a real address, so there is nothing to write a country into yet.
  // The 308 lands on `/`, which is then owed its own hop.
  it("settles the path before it settles the country", () => {
    proxy(makeRequest({ path: "/JOBS/jr41912", geo: "JP" }));

    expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    expect(NextResponse.redirect).toHaveBeenCalledWith(expect.anything(), 308);
  });
});
