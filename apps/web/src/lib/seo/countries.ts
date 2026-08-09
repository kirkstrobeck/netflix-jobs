// Country names as the crawl spells them -> ISO 3166-1 alpha-2, plus the label
// Google's own examples use inside an applicantLocationRequirements name.
//
// Google requires addressCountry on every jobLocation ("Note that you must
// include the addressCountry property" --
// developers.google.com/search/docs/appearance/structured-data/job-posting) and
// schema.org/PostalAddress says the two-letter code is the preferred form. The
// board's location strings carry the country as prose, so it has to be mapped.
//
// This table is deliberately a closed set rather than a guess: an unmapped
// country makes parseJobLocation return null, and the gate in
// tools/structured-data fails naming the string it could not place. Inventing a
// code for an unrecognised name is the one thing that must not happen -- a wrong
// addressCountry is worse than an omitted jobLocation.
type Country = {
  // Every spelling seen in the data, lowercased. "USA - Remote" and
  // "United States of America" are the same country under two names.
  names: string[];
  code: string;
  // The name used when this country appears in applicantLocationRequirements.
  // Google's example writes the United States as "USA", not "US".
  label: string;
};

const COUNTRIES: Country[] = [
  {
    names: ["united states of america", "united states", "usa", "us"],
    code: "US",
    label: "USA",
  },
  { names: ["canada"], code: "CA", label: "Canada" },
  { names: ["united kingdom", "uk"], code: "GB", label: "United Kingdom" },
  { names: ["germany"], code: "DE", label: "Germany" },
  { names: ["poland"], code: "PL", label: "Poland" },
  { names: ["france"], code: "FR", label: "France" },
  { names: ["spain"], code: "ES", label: "Spain" },
  { names: ["netherlands"], code: "NL", label: "Netherlands" },
  { names: ["sweden"], code: "SE", label: "Sweden" },
  { names: ["finland"], code: "FI", label: "Finland" },
  { names: ["italy"], code: "IT", label: "Italy" },
  { names: ["japan"], code: "JP", label: "Japan" },
  // The board writes this both ways, and the long form contains a comma -- which
  // is why the parser matches the country across segments, not on the last one.
  { names: ["korea, republic of", "korea", "south korea"], code: "KR", label: "Korea" },
  { names: ["singapore"], code: "SG", label: "Singapore" },
  { names: ["philippines"], code: "PH", label: "Philippines" },
  { names: ["india"], code: "IN", label: "India" },
  { names: ["indonesia"], code: "ID", label: "Indonesia" },
  { names: ["taiwan"], code: "TW", label: "Taiwan" },
  { names: ["thailand"], code: "TH", label: "Thailand" },
  { names: ["australia"], code: "AU", label: "Australia" },
  { names: ["mexico"], code: "MX", label: "Mexico" },
  { names: ["brazil"], code: "BR", label: "Brazil" },
  { names: ["colombia"], code: "CO", label: "Colombia" },
];

const BY_NAME = new Map(
  COUNTRIES.flatMap((country) => country.names.map((name) => [name, country])),
);

export function lookupCountry(name: string): { code: string; label: string } | null {
  const country = BY_NAME.get(name.trim().toLowerCase());

  if (!country) {
    return null;
  }

  return { code: country.code, label: country.label };
}
