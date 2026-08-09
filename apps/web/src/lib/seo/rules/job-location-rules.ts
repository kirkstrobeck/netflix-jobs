import { asList, isNode, isText, must, typeOf } from "@/lib/seo/rules/checks";

// The location half of Google's JobPosting rules, split out because between
// jobLocation, jobLocationType and applicantLocationRequirements it is most of
// them. Quotations are from
// developers.google.com/search/docs/appearance/structured-data/job-posting
// (fetched 2026-08-09).

// schema.org/AdministrativeArea subtypes Google's examples use for
// applicantLocationRequirements: {"@type": "Country"} and {"@type": "State"}.
const AREA_TYPES = new Set(["Country", "State", "AdministrativeArea"]);

// Required, with one documented escape: "The jobLocation property isn't required
// if applicantLocationRequirements is present." And where it IS present, "Note
// that you must include the addressCountry property."
export function checkJobLocation(node: Record<string, unknown>, out: string[]): void {
  asList(node.jobLocation).forEach((place, index) => {
    const at = `jobLocation[${index}]`;

    must(out, typeOf(place) === "Place", `${at} must be a Place`);

    const address = isNode(place) ? place.address : undefined;

    must(out, typeOf(address) === "PostalAddress", `${at}.address must be a PostalAddress`);

    const country = isNode(address) ? address.addressCountry : undefined;

    must(out, isText(country), `${at}.address.addressCountry is required`);
    // schema.org/PostalAddress: "The country... recommended to be in 2-letter
    // ISO 3166-1 alpha-2 format."
    must(
      out,
      typeof country !== "string" || /^[A-Z]{2}$/.test(country),
      `${at}.address.addressCountry should be an ISO 3166-1 alpha-2 code, got ${String(country)}`,
    );
  });
}

// "Set this property with the value TELECOMMUTE for jobs in which the employee
// may or must work remotely 100% of the time... You must specify a minimum of one
// country from which applicants are eligible to work, using
// applicantLocationRequirements (preferred), or a default to the country of a
// jobLocation."
export function checkRemote(node: Record<string, unknown>, out: string[]): void {
  const areas = asList(node.applicantLocationRequirements);
  const places = asList(node.jobLocation);
  const type = node.jobLocationType;

  must(
    out,
    type === undefined || type === "TELECOMMUTE",
    `jobLocationType must be TELECOMMUTE when present, got ${JSON.stringify(type)}`,
  );

  areas.forEach((area, index) => {
    const at = `applicantLocationRequirements[${index}]`;

    must(out, AREA_TYPES.has(typeOf(area) ?? ""), `${at} must be an AdministrativeArea`);
    must(out, isNode(area) && isText(area.name), `${at}.name is required`);
  });

  must(
    out,
    places.length > 0 || areas.length > 0,
    "jobLocation is required unless applicantLocationRequirements is present",
  );
  must(
    out,
    type !== "TELECOMMUTE" || places.length > 0 || areas.length > 0,
    "TELECOMMUTE requires applicantLocationRequirements or a jobLocation country",
  );
}
