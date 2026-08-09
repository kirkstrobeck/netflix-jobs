import { afterEach, describe, expect, it } from "vitest";

import { buildJobPosting } from "@/lib/seo/job-posting";
import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { hiringOrganization, netflixOrganization, NETFLIX_ID } from "@/lib/seo/organization";
import { checkOrganization } from "@/lib/seo/rules/organization-rules";
import { siteOrigin } from "@/lib/seo/site";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("netflixOrganization", () => {
  it("satisfies Google's Organization rules", () => {
    expect(checkOrganization(netflixOrganization())).toEqual([]);
  });

  it("names the company, its site and a logo we serve", () => {
    const org = netflixOrganization();

    expect(org.name).toBe("Netflix");
    expect(org.url).toBe("https://www.netflix.com");
    expect(org.logo).toBe(`${siteOrigin()}/icon1.png`);
  });
});

describe("hiringOrganization", () => {
  // The whole point of the @id: the posting's inline organization and the node
  // on the listing page are one entity, not two descriptions of Netflix.
  it("shares its @id with the standalone node", () => {
    expect(hiringOrganization()["@id"]).toBe(NETFLIX_ID);
    expect(netflixOrganization()["@id"]).toBe(NETFLIX_ID);
  });

  it("is inlined into the posting rather than referenced", () => {
    const posting = buildJobPosting(SAMPLE_JOB)!;

    expect(posting.hiringOrganization).toMatchObject({ name: "Netflix" });
  });
});

describe("siteOrigin", () => {
  it("follows NEXT_PUBLIC_SITE_URL and drops a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://jobs.example.com/";

    expect(siteOrigin()).toBe("https://jobs.example.com");
    expect(netflixOrganization().logo).toBe("https://jobs.example.com/icon1.png");
  });
});
