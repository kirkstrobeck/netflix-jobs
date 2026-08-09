import type { JobPosting, Place, WithContext } from "schema-dts";

import { postedOn } from "@/lib/jobs/date-posted";
import { descriptionHtml } from "@/lib/jobs/description-html";
import type { Job } from "@/lib/jobs/types";
import { parseJobLocation, type ParsedLocation } from "@/lib/seo/job-location";
import { hiringOrganization } from "@/lib/seo/organization";

// Properties Google lists that this board cannot fill, and why each is omitted
// rather than filled with something plausible:
//
//   employmentType   The board has no full-time/part-time/contract field at all.
//                    `work_type` is Onsite/Remote -- a location modality, not an
//                    employment type -- and mapping it to FULL_TIME would be a
//                    coin flip printed as fact.
//   validThrough     No expiry anywhere in the crawl. Google: "If a job posting
//                    never expires, or you do not know when the job will expire,
//                    do not include this property."
//   baseSalary       "Only employers can provide baseSalary" -- and no pay data
//                    is crawled regardless.
//   educationRequirements / experienceRequirements / occupationalCategory
//                    Present only as prose inside the description; extracting
//                    them would be inference, not data.

const REMOTE_WORK_TYPE = "Remote";

function locationsOf(job: Job): string[] {
  if (job.locations.length > 0) {
    return job.locations;
  }

  return job.location ? [job.location] : [];
}

// One crawled string can be a worksite or a work-from-home area, and a posting
// often lists both ("USA - Remote" alongside Los Gatos). Google's own second
// remote scenario is exactly that shape: jobLocation for the site, TELECOMMUTE
// for the option, applicantLocationRequirements for where home may be.
function parseAll(job: Job): ParsedLocation[] {
  const parsed = locationsOf(job).map(parseJobLocation);

  return parsed.filter((entry): entry is ParsedLocation => entry !== null);
}

function uniqueBy<T>(values: T[]): T[] {
  const seen = new Map<string, T>();

  values.forEach((value) => seen.set(JSON.stringify(value), value));

  return [...seen.values()];
}

function placesOf(parsed: ParsedLocation[]): Place[] {
  const places = parsed
    .filter((entry) => entry.kind === "place")
    .map((entry) => ({
      "@type": "Place" as const,
      address: { "@type": "PostalAddress" as const, ...entry.address },
    }));

  return uniqueBy(places);
}

function areasOf(parsed: ParsedLocation[]) {
  const areas = parsed
    .filter((entry) => entry.kind === "area")
    .map((entry) => ({ "@type": entry.type, name: entry.name }) as const);

  return uniqueBy(areas);
}

// TELECOMMUTE follows `work_type`, the employer's own value, which is also the
// string the page prints in its fact list -- so the page "clearly state[s] that
// the job is 100% remote" the way Google requires, and the markup is not
// claiming something the visitor cannot see.
function isRemote(job: Job): boolean {
  return job.work_type === REMOTE_WORK_TYPE;
}

/**
 * Build the JobPosting for one crawled row.
 *
 * Returns null when a property Google lists as required cannot be filled
 * honestly -- an undated posting, an empty description, a location string whose
 * country is unknown and no remote area to fall back on. The page then emits no
 * JobPosting at all, because a JobPosting missing a required property is not a
 * smaller rich result, it is an invalid one. tools/structured-data turns any
 * null into a failure naming the job, so this never happens quietly.
 */
export function buildJobPosting(job: Job): WithContext<JobPosting> | null {
  const posted = postedOn(job);
  const description = descriptionHtml(job.description_html);
  const parsed = parseAll(job);
  const places = placesOf(parsed);
  const areas = areasOf(parsed);
  const remote = isRemote(job);

  // Google: "The jobLocation property isn't required if
  // applicantLocationRequirements is present." One of the two must be.
  const located = places.length > 0 || (remote && areas.length > 0);

  if (!posted || !description || !job.title || !located) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    // Passed through exactly as crawled. Google: "If you're a third party job
    // site, don't attempt to modify the job title to follow the guidelines."
    title: job.title,
    description,
    datePosted: posted.iso,
    identifier: {
      "@type": "PropertyValue",
      name: "Netflix",
      value: job.display_job_id ?? String(job.position_id),
    },
    hiringOrganization: hiringOrganization(),
    ...(places.length > 0 ? { jobLocation: places } : {}),
    ...(remote ? { jobLocationType: "TELECOMMUTE" } : {}),
    ...(remote && areas.length > 0 ? { applicantLocationRequirements: areas } : {}),
    // False, and not a formality. Google defines a direct apply experience as one
    // where "the user completes the application process on your site". This is a
    // mirror: the Apply button hands the visitor to Netflix's own ATS, where the
    // application is filled in and submitted. Claiming true here would describe
    // someone else's form.
    directApply: false,
    // The posting's canonical address, which is also what this page declares in
    // <link rel="canonical">.
    url: job.canonical_url,
  };
}
