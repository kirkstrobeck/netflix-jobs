import { lookupCountry } from "@/lib/seo/countries";

// One crawled location string -> either a physical Place or a work-from-home
// area, because the board stores both in the same column.
//
// The two shapes exist because Google treats them differently. A physical site
// is jobLocation/PostalAddress; "USA - Remote" is not a place anyone reports to,
// it is the answer to "where may the applicant be", which is
// applicantLocationRequirements. Emitting the second as a PostalAddress would
// produce `addressLocality: "USA - Remote"`, which is markup that looks valid
// and says something false.
export type JobPlace = {
  kind: "place";
  address: {
    addressLocality?: string;
    addressRegion?: string;
    addressCountry: string;
  };
};

export type ApplicantArea = {
  kind: "area";
  // Country when the whole country is open; State when the board named a region,
  // e.g. "California - Remote,United States of America". Google's example for a
  // region is {"@type": "State", "name": "Michigan, USA"}.
  type: "Country" | "State";
  name: string;
};

export type ParsedLocation = JobPlace | ApplicantArea;

// "USA - Remote", "California - Remote", "Germany - Remote". The suffix is the
// board's own marker for a work-from-home listing; everything before it names
// the geography the applicant may sit in.
const REMOTE_SUFFIX = /^(.+?)\s*-\s*remote$/i;

function segmentsOf(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

// The country can span more than one segment -- "Seoul,Korea, Republic of"
// splits into three -- so the longest suffix that names a country wins. Starting
// at 0 and walking right tries the longest candidate first.
function splitCountry(segments: string[]) {
  for (let start = 0; start < segments.length; start += 1) {
    const country = lookupCountry(segments.slice(start).join(", "));

    if (country) {
      return { country, rest: segments.slice(0, start) };
    }
  }

  return null;
}

// Two leading segments are city then region; one is the city on its own; none
// leaves the country standing alone, which is all Google requires.
function addressOf(rest: string[], code: string): JobPlace {
  const [locality, region] = rest;

  return {
    kind: "place",
    address: {
      ...(locality ? { addressLocality: locality } : {}),
      ...(region ? { addressRegion: region } : {}),
      addressCountry: code,
    },
  };
}

function parseRemote(area: string, rest: string[]): ParsedLocation | null {
  const own = lookupCountry(area);

  // "Germany - Remote": the area is itself a country, so the whole country is
  // open and there is no region to name.
  if (own) {
    return { kind: "area", type: "Country", name: own.label };
  }

  const country = rest.length > 0 ? splitCountry(rest) : null;

  // A region with no country behind it -- "Someplace - Remote" -- is not
  // something we can turn into an AdministrativeArea Google will understand.
  if (!country) {
    return null;
  }

  return { kind: "area", type: "State", name: `${area}, ${country.country.label}` };
}

/**
 * Parse one entry of `jobs.locations` into the shape the JSON-LD needs.
 *
 * Returns null when the country cannot be identified. Callers drop the entry
 * rather than guessing; tools/structured-data turns a null into a build failure
 * naming the string, so a country the crawl has never produced before is caught
 * by the gate instead of silently vanishing from the markup.
 */
export function parseJobLocation(value: string): ParsedLocation | null {
  const segments = segmentsOf(value);

  if (segments.length === 0) {
    return null;
  }

  const remote = REMOTE_SUFFIX.exec(segments[0]);

  if (remote) {
    return parseRemote(remote[1].trim(), segments.slice(1));
  }

  const country = splitCountry(segments);

  if (!country) {
    return null;
  }

  return addressOf(country.rest, country.country.code);
}
