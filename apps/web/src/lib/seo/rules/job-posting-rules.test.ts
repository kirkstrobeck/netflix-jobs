import { describe, expect, it } from "vitest";

import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { buildJobPosting } from "@/lib/seo/job-posting";
import { checkJobPosting } from "@/lib/seo/rules/job-posting-rules";

// The rules have to reject as well as accept, or the gate is a formality. Each
// case below breaks exactly one thing Google's spec requires.
const valid = () => buildJobPosting(SAMPLE_JOB) as unknown as Record<string, unknown>;

const brokenBy = (patch: Record<string, unknown>) =>
  checkJobPosting({ ...valid(), ...patch }).join(" | ");

describe("checkJobPosting", () => {
  it("accepts a posting the builder produced", () => {
    expect(checkJobPosting(valid())).toEqual([]);
  });

  it("rejects anything that is not an object", () => {
    expect(checkJobPosting("JobPosting")).toEqual(["JobPosting must be a JSON object"]);
  });

  it("rejects the wrong context or type", () => {
    expect(brokenBy({ "@context": "http://schema.org" })).toContain("@context");
    expect(brokenBy({ "@type": "Job" })).toContain("@type must be JobPosting");
  });

  it("accepts the trailing-slash spelling of the context", () => {
    expect(checkJobPosting({ ...valid(), "@context": "https://schema.org/" })).toEqual([]);
  });

  it("requires a title and a description that are not the same string", () => {
    expect(brokenBy({ title: "" })).toContain("title is required");
    expect(brokenBy({ description: "" })).toContain("description is required");
    expect(brokenBy({ title: "x", description: "x" })).toContain(
      "description must not be the same as title",
    );
  });

  // "You must format the description in HTML. At minimum, add paragraph breaks
  // using <br>, <p>, or \n."
  it("requires the description to carry paragraph breaks", () => {
    expect(brokenBy({ description: "one long unbroken line of prose" })).toContain(
      "paragraph breaks",
    );
    expect(checkJobPosting({ ...valid(), description: "a\nb" })).toEqual([]);
  });

  it("requires an ISO 8601 datePosted and rejects a day that does not exist", () => {
    expect(brokenBy({ datePosted: "18/02/2016" })).toContain("datePosted");
    expect(brokenBy({ datePosted: "2026-02-31" })).toContain("datePosted");
    expect(checkJobPosting({ ...valid(), datePosted: "2026-01-24T19:33:17+00:00" })).toEqual([]);
  });

  it("requires a hiring organization with a name", () => {
    expect(brokenBy({ hiringOrganization: undefined })).toContain("hiringOrganization is required");
    expect(brokenBy({ hiringOrganization: { "@type": "Person", name: "n" } })).toContain(
      "must be an Organization",
    );
    expect(brokenBy({ hiringOrganization: { "@type": "Organization" } })).toContain(
      "hiringOrganization.name is required",
    );
  });

  it("requires the organization's logo and sameAs to be absolute URLs", () => {
    const org = { "@type": "Organization", name: "Netflix" };

    expect(brokenBy({ hiringOrganization: { ...org, logo: "/icon1.png" } })).toContain("logo");
    expect(brokenBy({ hiringOrganization: { ...org, sameAs: ["netflix.com"] } })).toContain(
      "sameAs",
    );
  });

  it("requires a country on every jobLocation, as an ISO alpha-2 code", () => {
    const place = (address: unknown) => ({ jobLocation: { "@type": "Place", address } });

    expect(checkJobPosting({ ...valid(), ...place({ "@type": "PostalAddress" }) })).toContain(
      "jobLocation[0].address.addressCountry is required",
    );
    expect(
      brokenBy(place({ "@type": "PostalAddress", addressCountry: "United States" })),
    ).toContain("ISO 3166-1 alpha-2");
    expect(brokenBy({ jobLocation: { "@type": "Place" } })).toContain("must be a PostalAddress");
    expect(brokenBy({ jobLocation: { "@type": "Organization" } })).toContain("must be a Place");
  });

  it("rejects a location or an applicant area given as a bare string", () => {
    expect(brokenBy({ jobLocation: "Los Gatos" })).toContain("jobLocation[0] must be a Place");
    expect(brokenBy({ applicantLocationRequirements: "USA" })).toContain(
      "must be an AdministrativeArea",
    );
  });

  it("requires at least one of jobLocation and applicantLocationRequirements", () => {
    expect(brokenBy({ jobLocation: undefined })).toContain("jobLocation is required unless");
  });

  it("rejects a jobLocationType other than TELECOMMUTE", () => {
    expect(brokenBy({ jobLocationType: "REMOTE" })).toContain("jobLocationType must be TELECOMMUTE");
  });

  it("requires applicant areas to be administrative areas with names", () => {
    expect(brokenBy({ applicantLocationRequirements: { "@type": "Place", name: "USA" } })).toContain(
      "must be an AdministrativeArea",
    );
    expect(brokenBy({ applicantLocationRequirements: { "@type": "Country" } })).toContain(
      "name is required",
    );
  });

  it("lets a TELECOMMUTE posting stand on its jobLocation country alone", () => {
    expect(checkJobPosting({ ...valid(), jobLocationType: "TELECOMMUTE" })).toEqual([]);
  });

  it("rejects a TELECOMMUTE posting with nowhere to work from", () => {
    expect(brokenBy({ jobLocationType: "TELECOMMUTE", jobLocation: undefined })).toContain(
      "TELECOMMUTE requires",
    );
  });

  it("checks the recommended properties only when they are present", () => {
    expect(brokenBy({ validThrough: "next spring" })).toContain("validThrough");
    expect(brokenBy({ identifier: { "@type": "PropertyValue", name: "Netflix" } })).toContain(
      "identifier",
    );
    expect(brokenBy({ employmentType: "Full Time" })).toContain("employmentType");
    expect(brokenBy({ directApply: "false" })).toContain("directApply");
    expect(
      checkJobPosting({
        ...valid(),
        validThrough: "2027-03-18T00:00",
        employmentType: ["FULL_TIME", "CONTRACTOR"],
      }),
    ).toEqual([]);
  });
});
