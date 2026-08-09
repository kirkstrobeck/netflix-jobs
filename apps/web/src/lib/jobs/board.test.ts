import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { SITES } from "@/lib/jobs/job-summary.fixture";

describe("siteCatalog", () => {
  it("indexes the sites by slug and collects their countries", () => {
    const catalog = siteCatalog(SITES);

    expect(catalog.bySlug.get("jp-tokyo")?.city).toBe("Tokyo");
    expect(catalog.countries.get("US")).toBe("United States");
    expect([...catalog.countries.keys()].sort()).toEqual(["CA", "JP", "US"]);
  });

  // deriveListing runs on every keystroke over a stable site array, so the
  // catalog is built once per site table rather than once per filter pass.
  it("is built once per site table", () => {
    expect(siteCatalog(SITES)).toBe(siteCatalog(SITES));
  });

  it("is a different catalog for a different site table", () => {
    expect(siteCatalog([...SITES])).not.toBe(siteCatalog(SITES));
  });
});
