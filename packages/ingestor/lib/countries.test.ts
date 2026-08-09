import { describe, expect, it } from 'vitest';

import { countryName, foldName, lookupCountry } from './countries.ts';

describe('foldName', () => {
  it('folds accents, full stops and runs of space', () => {
    expect(foldName('  U.S.A.  ')).toBe('usa');
    expect(foldName('México')).toBe('mexico');
    expect(foldName('Korea,  Republic  of')).toBe('korea, republic of');
  });
});

describe('lookupCountry', () => {
  it('resolves the display spelling', () => {
    expect(lookupCountry('Netherlands')).toEqual({ code: 'NL', name: 'Netherlands' });
  });

  it('resolves every spelling the board uses for one country to one code', () => {
    expect(lookupCountry('United States of America')?.code).toBe('US');
    expect(lookupCountry('USA')?.code).toBe('US');
    expect(lookupCountry('u.s.')?.code).toBe('US');
    expect(lookupCountry('Korea')?.code).toBe('KR');
    expect(lookupCountry('Korea, Republic of')?.code).toBe('KR');
  });

  it('gives one display name whichever spelling arrived', () => {
    expect(lookupCountry('Korea')?.name).toBe('South Korea');
    expect(lookupCountry('UK')?.name).toBe('United Kingdom');
  });

  // A fuzzy match would file a posting under a country code it made up. This
  // has to come back null so the ingestor can print the string instead.
  it('returns null for anything not in the table', () => {
    expect(lookupCountry('Atlantis')).toBeNull();
    expect(lookupCountry('CA')).toBeNull();
  });
});

describe('countryName', () => {
  it('maps a code back to its display name', () => {
    expect(countryName('BR')).toBe('Brazil');
  });

  it('returns null for a code the table does not carry', () => {
    expect(countryName('ZZ')).toBeNull();
  });
});
