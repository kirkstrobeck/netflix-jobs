// Raw board location string -> a normalised site record.
//
// Every shape the live board actually uses (surveyed over all 481 postings, 40
// distinct strings):
//
//   Los Angeles,California,United States of America   city, region, country
//   Vancouver,Canada                                  city, country
//   Los Angeles,United States of America              city, country -- same
//                                                     site as the first row
//   Seoul,Korea, Republic of                          the COUNTRY carries the
//                                                     comma, not the address
//   Singapore,Singapore                               city that is a country
//   New Jersey,New Jersey,United States of America    a state standing in for
//                                                     a city
//   East Dist.,Hsinchu City,Taiwan                    a district, not a city
//   Mumbai,Mahārāshtra,India                          diacritics; same site as
//                                                     'Mumbai,India'
//   USA - Remote                                      country-wide remote, and
//                                                     the country is an alias
//   Germany - Remote / Canada - Remote / Poland - Remote
//   California - Remote,United States of America      region-wide remote
//   A | B | C                                         several of the above, in
//                                                     the scalar jobs.location
//
// Two of those shapes are why this is not a three-way comma split. A comma can
// belong to the country ('Korea, Republic of'), so the country is matched as
// the longest SUFFIX that the alias table knows, and the address is whatever is
// left in front of it. And the same office arrives with and without its region,
// so the region is not part of the slug -- 'Vancouver,Canada' and
// 'Vancouver,British Columbia,Canada' both key on ca-vancouver, and the region
// on the row is the seed's spelling rather than whichever one the board sent.

import { lookupCountry, type Country } from './countries.ts';

export type Site = {
  slug: string;
  /** Null for a remote scope: a country is not a place inside itself. */
  city: string | null;
  region: string | null;
  countryCode: string;
  country: string;
  remote: boolean;
};

export type Parsed = { ok: true; site: Site } | { ok: false; reason: string };

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// jobs.location joins a posting's entries with ' | '; jobs.locations[] holds
// them already split. Both go through here so callers need not care which.
export function splitLocationEntries(raw: string): string[] {
  return raw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const REMOTE = /^(.*?)\s*-\s*remote$/i;

function commaParts(entry: string): string[] {
  return entry
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

// Longest known suffix wins, so 'Korea, Republic of' beats 'of' and
// 'Mexico City,Mexico' does not resolve to a country called Mexico City.
function takeCountry(parts: string[]): { country: Country; head: string[] } | null {
  for (let size = Math.min(3, parts.length); size >= 1; size -= 1) {
    const split = parts.length - size;
    const country = lookupCountry(parts.slice(split).join(', '));

    if (country) {
      return { country, head: parts.slice(0, split) };
    }
  }

  return null;
}

function remoteSite(country: Country, scope: string | null): Parsed {
  const code = country.code.toLowerCase();
  const suffix = scope ? `${slugify(scope)}-remote` : 'remote';

  return {
    ok: true,
    site: {
      slug: `${code}-${suffix}`,
      city: null,
      region: scope,
      countryCode: country.code,
      country: country.name,
      remote: true,
    },
  };
}

function placeSite(country: Country, head: string[]): Parsed {
  const city = head[0];

  if (!city) {
    return { ok: false, reason: 'country with no city' };
  }

  return {
    ok: true,
    site: {
      slug: `${country.code.toLowerCase()}-${slugify(city)}`,
      city,
      // 'East Dist.,Hsinchu City,Taiwan' puts the district first and the wider
      // area last, so the region is the LAST of what precedes the country.
      region: head.length > 1 ? head[head.length - 1] : null,
      countryCode: country.code,
      country: country.name,
      remote: false,
    },
  };
}

// 'USA - Remote' names its country inside the remote scope rather than as a
// comma-separated suffix, so it never reaches takeCountry.
function bareRemote(parts: string[]): Parsed {
  const match = REMOTE.exec(parts[parts.length - 1]);
  const scope = match ? match[1].trim() : '';
  const country = scope ? lookupCountry(scope) : null;

  if (!country) {
    return { ok: false, reason: `unknown country in ${JSON.stringify(parts.join(','))}` };
  }

  return remoteSite(country, null);
}

export function parseLocation(entry: string): Parsed {
  const parts = commaParts(entry);

  if (parts.length === 0) {
    return { ok: false, reason: 'empty location' };
  }

  const found = takeCountry(parts);

  if (!found) {
    return bareRemote(parts);
  }

  // 'California - Remote,United States of America': the country resolved, and
  // what is left in front of it is a region that is remote rather than a city.
  const match = REMOTE.exec(found.head[found.head.length - 1] ?? '');

  if (match) {
    return remoteSite(found.country, match[1].trim() || null);
  }

  return placeSite(found.country, found.head);
}
