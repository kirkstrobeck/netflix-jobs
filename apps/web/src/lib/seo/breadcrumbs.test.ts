import { describe, expect, it } from "vitest";

import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { buildBreadcrumbs } from "@/lib/seo/breadcrumbs";
import { checkBreadcrumbList } from "@/lib/seo/rules/breadcrumb-rules";
import { siteUrl } from "@/lib/seo/site";

const brokenBy = (patch: Record<string, unknown>) =>
  checkBreadcrumbList({ ...buildBreadcrumbs(SAMPLE_JOB), ...patch }).join(" | ");

describe("buildBreadcrumbs", () => {
  it("satisfies Google's BreadcrumbList rules", () => {
    expect(checkBreadcrumbList(buildBreadcrumbs(SAMPLE_JOB))).toEqual([]);
  });

  it("puts the board first and the posting last", () => {
    const crumbs = buildBreadcrumbs(SAMPLE_JOB);

    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Open roles", item: siteUrl("/") },
      { "@type": "ListItem", position: 2, name: SAMPLE_JOB.title },
    ]);
  });
});

describe("checkBreadcrumbList", () => {
  it("rejects anything that is not an object", () => {
    expect(checkBreadcrumbList([])).toEqual(["BreadcrumbList must be a JSON object"]);
  });

  it("rejects the wrong context or type", () => {
    expect(brokenBy({ "@context": "https://example.com" })).toContain("@context");
    expect(brokenBy({ "@type": "ItemList" })).toContain("@type must be BreadcrumbList");
  });

  it("requires a non-empty itemListElement array", () => {
    expect(brokenBy({ itemListElement: [] })).toContain("non-empty array");
    expect(brokenBy({ itemListElement: "Open roles" })).toContain("non-empty array");
  });

  it("requires each crumb to be a positioned, named ListItem", () => {
    const bad = [{ "@type": "Thing", position: 4, item: "https://example.com" }];

    expect(brokenBy({ itemListElement: bad })).toContain("must be a ListItem");
    expect(brokenBy({ itemListElement: bad })).toContain("position must be 1");
    expect(brokenBy({ itemListElement: bad })).toContain("name is required");
  });

  // "If the breadcrumb is the last item in the breadcrumb trail, item is not
  // required" -- but every earlier one needs a URL.
  it("requires item on every crumb but the last", () => {
    const trail = [
      { "@type": "ListItem", position: 1, name: "Open roles" },
      { "@type": "ListItem", position: 2, name: "A role" },
    ];

    expect(brokenBy({ itemListElement: trail })).toContain("itemListElement[0].item is required");
    expect(brokenBy({ itemListElement: trail })).not.toContain("itemListElement[1].item");
  });
});
