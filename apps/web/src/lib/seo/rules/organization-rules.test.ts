import { describe, expect, it } from "vitest";

import { netflixOrganization } from "@/lib/seo/organization";
import { checkOrganization } from "@/lib/seo/rules/organization-rules";

const brokenBy = (patch: Record<string, unknown>) =>
  checkOrganization({ ...netflixOrganization(), ...patch }).join(" | ");

describe("checkOrganization", () => {
  it("accepts the node the builder produces", () => {
    expect(checkOrganization(netflixOrganization())).toEqual([]);
  });

  it("rejects anything that is not an object", () => {
    expect(checkOrganization(null)).toEqual(["Organization must be a JSON object"]);
  });

  it("rejects the wrong context or type", () => {
    expect(brokenBy({ "@context": "https://example.com" })).toContain("@context");
    expect(brokenBy({ "@type": "Corporation" })).toContain("@type must be Organization");
  });

  it("requires a name", () => {
    expect(brokenBy({ name: "  " })).toContain("name is required");
  });

  it("requires url, logo, sameAs and @id to be absolute", () => {
    expect(brokenBy({ url: "/" })).toContain("url must be an absolute URL");
    expect(brokenBy({ logo: "icon1.png" })).toContain("logo must be an absolute URL");
    expect(brokenBy({ sameAs: ["about.netflix.com"] })).toContain("sameAs");
    expect(brokenBy({ "@id": "#netflix" })).toContain("@id must be an absolute IRI");
  });

  // Google: "There are no required properties; instead, add the properties that
  // apply to your organization."
  it("accepts a node carrying nothing but a name", () => {
    expect(
      checkOrganization({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Netflix",
      }),
    ).toEqual([]);
  });
});
