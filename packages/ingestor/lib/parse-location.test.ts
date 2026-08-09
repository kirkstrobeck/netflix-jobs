import { describe, expect, it } from 'vitest';

import { BOARD_LOCATION_STRINGS } from './board-locations.harness.ts';
import { parseLocation, slugify, splitLocationEntries } from './parse-location.ts';

function site(entry: string) {
  const parsed = parseLocation(entry);

  if (!parsed.ok) {
    throw new Error(`expected ${entry} to parse, got ${parsed.reason}`);
  }

  return parsed.site;
}

describe('splitLocationEntries', () => {
  it('splits the scalar column on its pipe and trims the pieces', () => {
    expect(splitLocationEntries('Tokyo,Japan | Seoul,Korea')).toEqual([
      'Tokyo,Japan',
      'Seoul,Korea',
    ]);
  });

  it('drops empty pieces rather than parsing them', () => {
    expect(splitLocationEntries(' | Tokyo,Japan |  | ')).toEqual(['Tokyo,Japan']);
  });
});

describe('slugify', () => {
  it('folds accents and punctuation to a bare kebab', () => {
    expect(slugify('Mahārāshtra')).toBe('maharashtra');
    expect(slugify('East Dist.')).toBe('east-dist');
    expect(slugify('  São Paulo  ')).toBe('sao-paulo');
  });
});

describe('parseLocation', () => {
  it('reads city, region and country', () => {
    expect(site('Los Angeles,California,United States of America')).toEqual({
      slug: 'us-los-angeles',
      city: 'Los Angeles',
      region: 'California',
      countryCode: 'US',
      country: 'United States',
      remote: false,
    });
  });

  it('reads a city with no region', () => {
    expect(site('Vancouver,Canada')).toMatchObject({
      slug: 'ca-vancouver',
      city: 'Vancouver',
      region: null,
      countryCode: 'CA',
    });
  });

  // The whole reason the country is matched as a suffix rather than as the
  // last comma field: this string has four fields and three of them are the
  // address.
  it('keeps a comma that belongs to the country name', () => {
    expect(site('Seoul,Korea, Republic of')).toMatchObject({
      slug: 'kr-seoul',
      city: 'Seoul',
      region: null,
      country: 'South Korea',
    });
  });

  it('reads a city that is also its country', () => {
    expect(site('Singapore,Singapore')).toMatchObject({
      slug: 'sg-singapore',
      city: 'Singapore',
      countryCode: 'SG',
    });
  });

  it('takes the widest of several address parts as the region', () => {
    expect(site('East Dist.,Hsinchu City,Taiwan')).toMatchObject({
      slug: 'tw-east-dist',
      city: 'East Dist.',
      region: 'Hsinchu City',
    });
  });

  // The point of leaving the region out of the slug: the board spells the same
  // office both ways, and both have to key on one row.
  it('keys one office to one slug however much of it the board spells out', () => {
    expect(site('Vancouver,British Columbia,Canada').slug).toBe(site('Vancouver,Canada').slug);
    expect(site('Mumbai,Mahārāshtra,India').slug).toBe(site('Mumbai,India').slug);
    expect(site('Los Angeles,United States of America').slug).toBe(
      site('Los Angeles,California,United States of America').slug,
    );
    expect(site('Seoul,Korea').slug).toBe(site('Seoul,Korea, Republic of').slug);
  });

  it('reads a country-wide remote scope, whose country is an alias', () => {
    expect(site('USA - Remote')).toEqual({
      slug: 'us-remote',
      city: null,
      region: null,
      countryCode: 'US',
      country: 'United States',
      remote: true,
    });
    expect(site('Germany - Remote').slug).toBe('de-remote');
  });

  it('reads a region-wide remote scope with its country spelled after it', () => {
    expect(site('California - Remote,United States of America')).toMatchObject({
      slug: 'us-california-remote',
      city: null,
      region: 'California',
      remote: true,
    });
  });

  // ' - Remote,Poland' has a remote marker and nothing in front of it. That is
  // country-wide remote, not a region called '': it must not key on 'pl--remote'.
  it('reads a remote marker with no scope as the whole country', () => {
    expect(site(' - Remote,Poland')).toMatchObject({
      slug: 'pl-remote',
      region: null,
      remote: true,
    });
  });

  it('reports an empty string rather than inventing a site', () => {
    expect(parseLocation('  ,  ')).toEqual({ ok: false, reason: 'empty location' });
  });

  it('reports a country with no place in it', () => {
    expect(parseLocation('Japan')).toEqual({ ok: false, reason: 'country with no city' });
  });

  it('reports an unknown country rather than guessing a code for it', () => {
    expect(parseLocation('Atlantis')).toEqual({
      ok: false,
      reason: 'unknown country in "Atlantis"',
    });
    expect(parseLocation('Ruritania - Remote')).toEqual({
      ok: false,
      reason: 'unknown country in "Ruritania - Remote"',
    });
  });
});

describe('the live board', () => {
  it('parses every one of its 40 distinct location strings', () => {
    const failed = BOARD_LOCATION_STRINGS.filter((entry) => !parseLocation(entry).ok);

    expect(failed).toEqual([]);
  });

  it('collapses those 40 strings onto 36 sites', () => {
    const slugs = new Set(BOARD_LOCATION_STRINGS.map((entry) => site(entry).slug));

    expect(slugs.size).toBe(36);
    expect([...slugs].filter((slug) => slug.endsWith('-remote')).length).toBe(5);
  });
});
