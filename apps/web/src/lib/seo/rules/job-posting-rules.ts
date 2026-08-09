import { asList, isAbsoluteUrl, isIso8601, isNode, isText, must, typeOf } from "@/lib/seo/rules/checks";
import { checkJobLocation, checkRemote } from "@/lib/seo/rules/job-location-rules";

// Google's JobPosting requirements, transcribed from
// developers.google.com/search/docs/appearance/structured-data/job-posting
// (fetched 2026-08-09), with the sentence each rule comes from quoted above it.
//
// This is not a diff against a fixture we produced. A fixture test passes as
// happily on markup that is wrong in both places; these are the constraints
// themselves, so the only way to satisfy them is to actually satisfy Google.
//
// Every rule that Google states as conditional stays conditional here. Absent
// recommended properties are not violations -- omitting what the crawl does not
// have is the correct behaviour, not a gap to be papered over.

// "Choose one or more of the following case-sensitive values."
const EMPLOYMENT_TYPES = new Set([
  "FULL_TIME",
  "PART_TIME",
  "CONTRACTOR",
  "TEMPORARY",
  "INTERN",
  "VOLUNTEER",
  "PER_DIEM",
  "OTHER",
]);

function checkContext(node: Record<string, unknown>, out: string[]): void {
  const context = node["@context"];

  must(
    out,
    context === "https://schema.org" || context === "https://schema.org/",
    `@context must be https://schema.org, got ${JSON.stringify(context)}`,
  );
  must(out, node["@type"] === "JobPosting", `@type must be JobPosting`);
}

function checkTitleAndDescription(node: Record<string, unknown>, out: string[]): void {
  // Required. "The title of the job (not the title of the posting)."
  must(out, isText(node.title), "title is required and must be non-empty text");

  // Required. "The full description of the job in HTML format... You must format
  // the description in HTML. At minimum, add paragraph breaks using <br>, <p>,
  // or \n."
  const description = node.description;
  must(out, isText(description), "description is required and must be non-empty text");
  must(
    out,
    typeof description !== "string" || /<p[ >]|<br\s*\/?>|\n/i.test(description),
    "description must be HTML with paragraph breaks (<p>, <br> or \\n)",
  );

  // "The description can't be the same as the title."
  must(
    out,
    node.description !== node.title,
    "description must not be the same as title",
  );
}

function checkHiringOrganization(node: Record<string, unknown>, out: string[]): void {
  // Required. "The organization offering the job position. This must be the name
  // of the company."
  const org = node.hiringOrganization;

  must(out, isNode(org), "hiringOrganization is required and must be an object");

  if (!isNode(org)) {
    return;
  }

  must(out, typeOf(org) === "Organization", "hiringOrganization must be an Organization");
  must(out, isText(org.name), "hiringOrganization.name is required");
  // "For JobPosting structured data, the image width and height ratio must be
  // between 0.75 and 2.5" -- the ratio is checked against the file itself in
  // tools/structured-data/logo.mjs; here the URL only has to be fetchable.
  must(
    out,
    org.logo === undefined || isAbsoluteUrl(org.logo),
    "hiringOrganization.logo must be an absolute URL",
  );
  must(
    out,
    org.sameAs === undefined || asList(org.sameAs).every(isAbsoluteUrl),
    "hiringOrganization.sameAs must be absolute URLs",
  );
}

function checkDatesAndIdentity(node: Record<string, unknown>, out: string[]): void {
  // "The original date that employer posted the job in ISO 8601 format." Required.
  must(out, isIso8601(node.datePosted), "datePosted is required and must be ISO 8601");

  // "This is required for job postings that have an expiration date... If a job
  // posting never expires, or you do not know when the job will expire, do not
  // include this property." And: "We don't allow expired job postings."
  must(
    out,
    node.validThrough === undefined || isIso8601(node.validThrough),
    "validThrough must be ISO 8601",
  );

  const identifier = node.identifier;
  must(
    out,
    identifier === undefined ||
      (typeOf(identifier) === "PropertyValue" &&
        isNode(identifier) &&
        isText(identifier.name) &&
        isText(identifier.value)),
    "identifier must be a PropertyValue with name and value",
  );

  must(
    out,
    asList(node.employmentType).every((value) => EMPLOYMENT_TYPES.has(String(value))),
    "employmentType must be one of Google's case-sensitive values",
  );

  must(
    out,
    node.directApply === undefined || typeof node.directApply === "boolean",
    "directApply must be a boolean",
  );
}

export function checkJobPosting(value: unknown): string[] {
  const out: string[] = [];

  if (!isNode(value)) {
    return ["JobPosting must be a JSON object"];
  }

  checkContext(value, out);
  checkTitleAndDescription(value, out);
  checkHiringOrganization(value, out);
  checkJobLocation(value, out);
  checkRemote(value, out);
  checkDatesAndIdentity(value, out);

  return out;
}
