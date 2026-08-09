import { describe, expect, it } from "vitest";

import {
  COUNTRY_COOKIE,
  countryCookieValue,
  readCountryCookie,
  rememberCountry,
} from "@/lib/geo/country-cookie";

describe("readCountryCookie", () => {
  it("reads one country", () => {
    expect(readCountryCookie("JP")).toEqual({ countries: ["JP"] });
  });

  it("upper-cases and de-duplicates, so one set is one value", () => {
    expect(readCountryCookie("jp,US,jp")).toEqual({ countries: ["JP", "US"] });
  });

  /**
   * An empty list and `null` are the two answers this has to keep apart, and
   * they are the whole of "detection must never fight the user": no cookie is
   * a visitor who has not said, and a cookie of `all` is one who said "every
   * country". The first must let detection answer and the second must not.
   */
  it("tells an explicit everywhere apart from no cookie at all", () => {
    expect(readCountryCookie("all")).toEqual({ countries: [] });
    expect(readCountryCookie(undefined)).toBeNull();
    expect(readCountryCookie("")).toBeNull();
  });

  // Anything unparseable falls back to detection rather than filtering the
  // board to a country that is not there -- an old spelling, or somebody
  // editing the cookie by hand, should not produce an empty listing.
  it("is null for anything that is not a list of country codes", () => {
    expect(readCountryCookie("USA")).toBeNull();
    expect(readCountryCookie("en-US")).toBeNull();
    expect(readCountryCookie("US,")).toBeNull();
    expect(readCountryCookie("US,nonsense")).toBeNull();
  });
});

describe("countryCookieValue", () => {
  it("writes a chosen set as codes", () => {
    expect(countryCookieValue(["US", "JP"])).toBe("US,JP");
  });

  // Not the empty string: that is indistinguishable from no cookie, and the
  // difference between the two is the point of the whole arrangement.
  it("writes an empty choice as an explicit everywhere", () => {
    expect(countryCookieValue([])).toBe("all");
  });

  it("round-trips whatever it wrote", () => {
    expect(readCountryCookie(countryCookieValue(["JP", "US"]))?.countries).toEqual([
      "JP",
      "US",
    ]);
    expect(readCountryCookie(countryCookieValue([]))?.countries).toEqual([]);
  });
});

describe("rememberCountry", () => {
  it("writes the choice where the SERVER can read it on the next request", () => {
    rememberCountry(["CA"]);

    expect(document.cookie).toContain(`${COUNTRY_COOKIE}=CA`);
  });

  it("writes an everywhere too, so clearing is remembered like any choice", () => {
    rememberCountry([]);

    expect(document.cookie).toContain(`${COUNTRY_COOKIE}=all`);
  });
});
