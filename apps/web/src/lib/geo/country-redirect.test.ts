import { describe, expect, it } from "vitest";

import { countryRedirect } from "@/lib/geo/country-redirect";

const at = (search: string, countries: string[] = ["US"]) =>
  countryRedirect(new URLSearchParams(search), countries);

describe("the country hop", () => {
  it("writes a matched country into a bare listing URL", () => {
    expect(at("")).toBe("?country=US");
  });

  it("keeps the rest of the query as it found it", () => {
    expect(at("team=Engineering&page=3")).toBe("?team=Engineering&page=3&country=US");
  });

  /**
   * The campaign that sent someone here is not the listing's business and is
   * not the listing's to lose. Rebuilding the target from the parsed query
   * would spell it canonically and drop everything the query model does not
   * know about, which is most of what a marketing link carries.
   */
  it("carries parameters the listing does not model", () => {
    expect(at("utm_source=newsletter")).toBe("?utm_source=newsletter&country=US");
  });

  it("writes every country when more than one is remembered", () => {
    expect(at("", ["CA", "US"])).toBe("?country=CA&country=US");
  });

  // A shared link is authoritative. "Here are the Tokyo roles" is not rewritten
  // to the recipient's own country, and that is the whole of "detection never
  // overwrites a country carried in a shared link".
  it("leaves a URL that already names a country alone", () => {
    expect(at("country=JP")).toBeNull();
  });

  // `?country=all` is not a URL any more -- canonical-search.ts unspells it one
  // step earlier, so what reaches here is the bare listing it becomes. A URL
  // that names no country has not answered, and is owed the hop.
  it("hops a URL that names no country", () => {
    expect(at("country=all")).toBe("?country=US");
  });

  // Nothing would be applied, so there is nothing the URL is failing to say.
  // A bare `/` IS the address of an unfiltered listing.
  it("does not hop when no country is owed", () => {
    expect(at("", [])).toBeNull();
  });

  /**
   * THE FIXED POINT. Every target this produces answers the country question,
   * so running the hop again on it stops. If this ever fails, the browser is in
   * a redirect loop.
   */
  it("never hops twice", () => {
    const once = at("team=Engineering");

    expect(once).toBe("?team=Engineering&country=US");
    expect(at(once!)).toBeNull();
  });

  // `?country=` parses to no country at all, so it does not answer the
  // question -- and leaving it in place would spell the answer
  // `?country=&country=US`, which is one question with two entries.
  it("replaces a blank country rather than adding to it", () => {
    expect(at("country=")).toBe("?country=US");
  });
});
