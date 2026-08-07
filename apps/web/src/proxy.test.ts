import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { config, proxy } from "@/proxy";

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: "next" })),
    redirect: vi.fn((url: unknown, status: number) => ({ type: "redirect", url, status })),
  },
}));

function makeRequest(pathname: string): NextRequest {
  return {
    nextUrl: {
      pathname,
      clone() {
        return { pathname, search: "?x=1" };
      },
    },
  } as unknown as NextRequest;
}

describe("proxy", () => {
  it("passes an already-canonical path through", () => {
    const request = makeRequest("/jobs/JR41912");

    const result = proxy(request);

    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ type: "next" });
  });

  it("redirects a mis-cased path to the canonical form", () => {
    const request = makeRequest("/Jobs/jr41912");

    proxy(request);

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
