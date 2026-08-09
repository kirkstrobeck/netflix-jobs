import { headers } from "next/headers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/where/route";
import { GEO_HEADER } from "@/lib/geo/country-default";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

const request = (geo?: string) => {
  vi.mocked(headers).mockResolvedValue(
    new Headers(geo === undefined ? {} : { [GEO_HEADER]: geo }),
    // next/headers returns a ReadonlyHeaders, which a Headers satisfies for
    // everything this route does with it.
  );

  return GET();
};

afterEach(() => {
  delete process.env.DEV_GEO_COUNTRY;
  vi.mocked(headers).mockReset();
});

describe("GET /api/where", () => {
  it("answers with the country the edge read off the request", async () => {
    await expect((await request("JP")).json()).resolves.toEqual({ country: "JP" });
  });

  /**
   * THE WHOLE POINT OF THE ROUTE IS WHAT IT DOES WITH SILENCE.
   *
   * countryDefault answers "US" to a request it knows nothing about, and that
   * is right for a FILTER -- it is a policy, and it is written into the address
   * bar where it can be changed. It is wrong here. The heading built on this
   * says "you are in the United States", which is a claim about a person, and a
   * visitor cannot tell a guess from a fact. So no signal is no answer.
   */
  it("says nothing rather than guessing, with no header at all", async () => {
    await expect((await request()).json()).resolves.toEqual({ country: null });
  });

  it("says nothing when the edge could not place the address", async () => {
    // The empty value is what the header carries when the lookup failed.
    await expect((await request("")).json()).resolves.toEqual({ country: null });
    await expect((await request("XYZ")).json()).resolves.toEqual({ country: null });
  });

  // The same override the proxy uses, rather than a second one for this route.
  it("takes DEV_GEO_COUNTRY on localhost, where there is no edge", async () => {
    process.env.DEV_GEO_COUNTRY = "pl";

    await expect((await request()).json()).resolves.toEqual({ country: "PL" });
  });

  it("lets a real header outrank the dev override", async () => {
    process.env.DEV_GEO_COUNTRY = "PL";

    await expect((await request("CA")).json()).resolves.toEqual({ country: "CA" });
  });

  // `none` is how a developer says "an edge that could not place me", which is
  // otherwise unreachable by hand -- and it must not fall through to a default.
  it("keeps the unplaceable case reachable on localhost", async () => {
    process.env.DEV_GEO_COUNTRY = "none";

    await expect((await request()).json()).resolves.toEqual({ country: null });
  });

  /**
   * The answer is keyed on an IP address, which is not in the URL a shared
   * cache keys on. A CDN holding it for even a minute would tell the next
   * visitor they are wherever the last one was.
   */
  it("is never stored by anything in front of it", async () => {
    expect((await request("US")).headers.get("cache-control")).toBe(
      "private, no-store",
    );
  });
});
