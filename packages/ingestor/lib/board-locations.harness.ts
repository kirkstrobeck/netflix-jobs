// Every distinct location string on the live board, taken from the mirror:
//
//   select distinct unnest(locations) from jobs order by 1;
//
// 40 strings across 481 postings, 2026-08-09. This is the fixture the parser
// and the seed are held to, in preference to a handful of invented examples --
// the awkward shapes here (a country with a comma in it, a district standing in
// for a city, one office spelled two ways) are the ones nobody would think to
// invent. Refresh it from the query above after a crawl that adds a site.
//
// Not a test file and not shipped code, so vitest.config.ts keeps it out of the
// coverage report.

export const BOARD_LOCATION_STRINGS = [
  'Amsterdam,Netherlands',
  'Bangkok,Thailand',
  'Beckwourth,California,United States of America',
  'Berlin,Germany',
  'Bogota,Colombia',
  'Burbank,California,United States of America',
  'California - Remote,United States of America',
  'Canada - Remote',
  'East Dist.,Hsinchu City,Taiwan',
  'Germany - Remote',
  'Helsinki,Finland',
  'Jakarta,Indonesia',
  'London,United Kingdom',
  'Los Angeles,California,United States of America',
  'Los Angeles,United States of America',
  'Los Gatos,California,United States of America',
  'Madrid,Spain',
  'Manila,Philippines',
  'Melbourne,Australia',
  'Mexico City,Mexico',
  'Mumbai,India',
  'Mumbai,Mahārāshtra,India',
  'New Jersey,New Jersey,United States of America',
  'New York,New York,United States of America',
  'Paris,France',
  'Poland - Remote',
  'Sao Paulo,Brazil',
  'Seattle,Washington,United States of America',
  'Seoul,Korea',
  'Seoul,Korea, Republic of',
  'Singapore,Singapore',
  'Stockholm,Sweden',
  'Sydney,Australia',
  'Taipei City,Taiwan',
  'Tokyo,Japan',
  'USA - Remote',
  'Vancouver,British Columbia,Canada',
  'Vancouver,Canada',
  'Warsaw,Poland',
  'Washington DC,District of Columbia,United States of America',
];
