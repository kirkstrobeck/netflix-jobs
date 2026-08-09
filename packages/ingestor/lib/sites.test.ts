import { describe, expect, it } from 'vitest';

import { BOARD_LOCATION_STRINGS } from './board-locations.harness.ts';
import { countryName } from './countries.ts';
import { parseLocation, slugify } from './parse-location.ts';
import { SITE_SEED } from './sites-seed.ts';
import { assignSites, seedRows, tallyUnplaced } from './sites.ts';

const rows = seedRows();
const bySlug = new Map(rows.map((row) => [row.slug, row]));

describe('the seed', () => {
  it('covers every location string on the live board', () => {
    const { slugs, unplaced } = assignSites(BOARD_LOCATION_STRINGS);

    expect(unplaced).toEqual([]);
    expect(slugs.length).toBe(SITE_SEED.length);
  });

  it('has a unique slug per site', () => {
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
  });

  // A seed slug the parser can never derive is a site that can never be linked.
  it('spells every slug the way the parser derives it', () => {
    const derivable = rows.filter((row) => {
      const stem = row.is_remote ? 'remote' : slugify(row.city ?? '');
      const region = row.region ? `${slugify(row.region)}-` : '';
      const prefix = row.country_code.toLowerCase();

      return row.slug === `${prefix}-${stem}` || row.slug === `${prefix}-${region}${stem}`;
    });

    expect(derivable.length).toBe(rows.length);
  });

  it('names a country the table knows, for every site', () => {
    expect(rows.filter((row) => countryName(row.country_code) === null)).toEqual([]);
  });

  // The shape the database also enforces, asserted here so a bad seed line
  // fails in the suite rather than at 3am against a migration.
  it('gives coordinates to every place and to no remote scope', () => {
    const places = rows.filter((row) => !row.is_remote);
    const remote = rows.filter((row) => row.is_remote);

    expect(places.length).toBe(31);
    expect(remote.length).toBe(5);
    expect(places.filter((row) => row.coords === null)).toEqual([]);
    expect(remote.filter((row) => row.coords !== null)).toEqual([]);
    expect(remote.filter((row) => row.city !== null)).toEqual([]);
  });

  it('writes coordinates as one point literal, longitude first', () => {
    expect(bySlug.get('us-los-gatos')?.coords).toBe('(-121.9624,37.2358)');
  });

  it('composes a display name from the site rather than from the raw string', () => {
    expect(bySlug.get('us-los-gatos')?.display_name).toBe('Los Gatos, California, United States');
    expect(bySlug.get('nl-amsterdam')?.display_name).toBe('Amsterdam, Netherlands');
    expect(bySlug.get('us-remote')?.display_name).toBe('Remote, United States');
    expect(bySlug.get('us-california-remote')?.display_name).toBe(
      'Remote, California, United States',
    );
  });

  it('says a city that is its own country once', () => {
    expect(bySlug.get('sg-singapore')?.display_name).toBe('Singapore');
  });

  // 'Mumbai,India' carries no region; the row still gets Maharashtra.
  it('spells the region even when the board omitted it', () => {
    expect(bySlug.get('in-mumbai')?.region).toBe('Maharashtra');
    expect(bySlug.get('ca-vancouver')?.region).toBe('British Columbia');
  });
});

describe('assignSites', () => {
  it('deduplicates the sites a posting is listed in', () => {
    const { slugs } = assignSites([
      'Los Angeles,California,United States of America',
      'Los Angeles,United States of America',
      'Tokyo,Japan',
    ]);

    expect(slugs).toEqual(['us-los-angeles', 'jp-tokyo']);
  });

  it('splits an entry that is itself the pipe-joined scalar', () => {
    expect(assignSites(['Tokyo,Japan | Seoul,Korea']).slugs).toEqual(['jp-tokyo', 'kr-seoul']);
  });

  it('follows the seed alias for a raw string that names a district', () => {
    expect(assignSites(['East Dist.,Hsinchu City,Taiwan']).slugs).toEqual(['tw-hsinchu']);
  });

  // The requirement this exists for: an uncovered site costs the posting one
  // link and nothing else.
  it('keeps the sites it can place and reports the ones it cannot', () => {
    const { slugs, unplaced } = assignSites(['Tokyo,Japan', 'Nairobi,Kenya', 'Reykjavik,Iceland']);

    expect(slugs).toEqual(['jp-tokyo']);
    expect(unplaced.map((miss) => miss.raw)).toEqual(['Nairobi,Kenya', 'Reykjavik,Iceland']);
  });

  it('says which of the two ways a string failed', () => {
    expect(assignSites(['Perth,Australia']).unplaced[0].reason).toBe(
      'no seed entry for au-perth',
    );
    expect(assignSites(['Atlantis']).unplaced[0].reason).toBe('unknown country in "Atlantis"');
  });
});

describe('tallyUnplaced', () => {
  it('counts the postings each uncovered string costs, worst first', () => {
    expect(
      tallyUnplaced([
        ['Tokyo,Japan', 'Perth,Australia'],
        ['Perth,Australia'],
        ['Zurich,Switzerland'],
        ['Atlantis'],
      ]),
    ).toEqual([
      { raw: 'Perth,Australia', reason: 'no seed entry for au-perth', jobs: 2 },
      { raw: 'Atlantis', reason: 'unknown country in "Atlantis"', jobs: 1 },
      { raw: 'Zurich,Switzerland', reason: 'unknown country in "Zurich,Switzerland"', jobs: 1 },
    ]);
  });

  it('is empty for a board the seed covers', () => {
    expect(tallyUnplaced([BOARD_LOCATION_STRINGS])).toEqual([]);
  });
});

describe('parse and seed together', () => {
  it('leaves no seeded slug the board cannot reach', () => {
    const reachable = new Set(
      BOARD_LOCATION_STRINGS.flatMap((entry) => {
        const parsed = parseLocation(entry);

        return parsed.ok ? [parsed.site.slug] : [];
      }),
    );

    expect(reachable.size).toBe(SITE_SEED.length);
  });
});
