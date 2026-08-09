import { describe, expect, it } from "vitest";

import { canonicalSearch } from "@/lib/search/canonical-search";

const at = (search: string) => canonicalSearch(new URLSearchParams(search));

/**
 * Two defaults, each with exactly one spelling: newest is silence, and every
 * country is silence. Anything else arriving is an old link or a hand-typed
 * one, and it is answered with the address that means the same thing.
 */
describe("sort", () => {
  it("leaves the only sort the URL carries alone", () => {
    expect(at("sort=near")).toBeNull();
  });

  it("says nothing at all about the default", () => {
    expect(at("")).toBeNull();
  });

  // `new` is what sortParam calls newest, so this is the spelling we could once
  // have produced ourselves; `newest` and the junk below never were.
  it.each(["sort=new", "sort=newest", "sort=", "sort=banana"])(
    "unspells ?%s",
    (search) => {
      expect(at(search)).toBe("");
    },
  );

  it("folds a long spelling of nearest onto the short one", () => {
    expect(at("sort=nearest")).toBe("?sort=near");
  });

  // set() replaces in place, so a URL that is already canonical does not
  // redirect to itself with the params shuffled into a different order.
  it("does not reorder a query it agrees with", () => {
    expect(at("country=US&sort=near&page=3")).toBeNull();
  });
});

describe("country=all", () => {
  it("drops the word entirely", () => {
    expect(at("country=all")).toBe("");
  });

  it("keeps everything else that was on the URL", () => {
    expect(at("country=all&team=Engineering&page=2")).toBe("?team=Engineering&page=2");
  });

  // Two answers to one question. The country that names a country wins, which
  // is the same rule the URL has always used against the cookie.
  it("resolves it beside a real country to that country", () => {
    expect(at("country=all&country=JP")).toBe("?country=JP");
  });

  it("is not case sensitive about it", () => {
    expect(at("country=ALL")).toBe("");
  });
});

// A campaign parameter is not ours to tidy, and a redirect that eats the thing
// that sent someone here is a redirect that costs money.
describe("everything else", () => {
  it("is carried across untouched", () => {
    expect(at("sort=new&utm_source=news&src=test")).toBe("?utm_source=news&src=test");
  });
});

/**
 * THE FIXED POINT. Everything this returns is already canonical, so running it
 * again stops. If this ever fails, the browser is in a redirect loop.
 */
describe("running it on its own answer", () => {
  it.each([
    "sort=new",
    "sort=nearest",
    "country=all",
    "country=all&country=JP&sort=newest",
    "country=ALL&utm_source=news",
  ])("stops after one hop from ?%s", (search) => {
    const once = canonicalSearch(new URLSearchParams(search));

    expect(once).not.toBeNull();
    expect(canonicalSearch(new URLSearchParams(once!))).toBeNull();
  });
});
