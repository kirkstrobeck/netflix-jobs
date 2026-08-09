// ISO-3166-1 alpha-2 for every country the board names, and every spelling it
// names them with.
//
// A closed table rather than a library: the board uses 22 countries, it writes
// some of them in more than one way ('Korea' and 'Korea, Republic of' are the
// same place), and an unknown country has to be REPORTED rather than guessed at
// -- a fuzzy match would invent a country code and quietly file a posting under
// it. Anything not below comes back null and the ingestor prints it.

export type Country = { code: string; name: string };

// [alpha-2, display name, other spellings seen on the board]
const TABLE: Array<[string, string, string[]]> = [
  ['AU', 'Australia', []],
  ['BR', 'Brazil', ['Brasil']],
  ['CA', 'Canada', []],
  ['CO', 'Colombia', []],
  ['DE', 'Germany', ['Deutschland']],
  ['ES', 'Spain', ['España']],
  ['FI', 'Finland', []],
  ['FR', 'France', []],
  ['GB', 'United Kingdom', ['UK', 'Great Britain']],
  ['ID', 'Indonesia', []],
  ['IN', 'India', []],
  ['JP', 'Japan', []],
  ['KR', 'South Korea', ['Korea', 'Korea, Republic of']],
  ['MX', 'Mexico', ['México']],
  ['NL', 'Netherlands', ['The Netherlands', 'Holland']],
  ['PH', 'Philippines', ['The Philippines']],
  ['PL', 'Poland', ['Polska']],
  ['SE', 'Sweden', ['Sverige']],
  ['SG', 'Singapore', []],
  ['TH', 'Thailand', []],
  ['TW', 'Taiwan', ['Taiwan, Province of China']],
  ['US', 'United States', ['United States of America', 'USA', 'US', 'U.S.', 'U.S.A.']],
];

// Accents and full stops are noise for matching: 'U.S.A.' and 'USA' are one
// spelling, and so are 'Mexico' and 'México'. Commas are NOT stripped, because
// 'Korea, Republic of' carries one and matching depends on it.
export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const INDEX = new Map<string, Country>();

for (const [code, name, spellings] of TABLE) {
  const country: Country = { code, name };

  for (const spelling of [name, ...spellings]) {
    INDEX.set(foldName(spelling), country);
  }
}

export function lookupCountry(value: string): Country | null {
  return INDEX.get(foldName(value)) ?? null;
}

export function countryName(code: string): string | null {
  const found = TABLE.find(([alpha2]) => alpha2 === code);

  return found ? found[1] : null;
}
