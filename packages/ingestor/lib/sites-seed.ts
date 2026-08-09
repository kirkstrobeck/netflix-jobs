// The curated site list. This file is the only source of coordinates.
//
// Nothing geocodes at runtime. The board has used 36 distinct sites across 481
// postings and adds one every few months, so a checked-in table is both smaller
// and more honest than a network call: it is reviewable in a diff, it cannot
// rate-limit an ingest, and it cannot silently move an office. When the board
// names a site that is not here, the ingestor prints it and keeps the posting
// (see lib/sites.ts) -- the role stays on the board with the sites it could
// place, and this file is what gets edited in response.
//
// `coords` is [latitude, longitude], city centre rather than street address:
// nearest-sort ranks cities, and a rooftop fix would imply a precision the
// board's own strings do not have. A remote scope has NO coords key at all --
// not zeroes, not nulls -- and the database will reject it if it grows one.
//
// `alsoKnownAs` redirects a slug the parser derives from a raw string that is
// not quite the site's name. The board writes Netflix's Hsinchu office as its
// district ('East Dist.,Hsinchu City,Taiwan'), which derives tw-east-dist.

export type SeedSite = {
  slug: string;
  /** ISO-3166-1 alpha-2; the display name comes from lib/countries.ts. */
  country: string;
  city?: string;
  /** Omitted when it would only repeat the city. */
  region?: string;
  /** [latitude, longitude]. Absent, as a pair, for a remote scope. */
  coords?: [number, number];
  remote?: true;
  alsoKnownAs?: string[];
};

export const SITE_SEED: SeedSite[] = [
  { slug: 'au-melbourne', country: 'AU', city: 'Melbourne', coords: [-37.8136, 144.9631] },
  { slug: 'au-sydney', country: 'AU', city: 'Sydney', coords: [-33.8688, 151.2093] },
  { slug: 'br-sao-paulo', country: 'BR', city: 'São Paulo', coords: [-23.5505, -46.6333] },
  { slug: 'ca-remote', country: 'CA', remote: true },
  {
    slug: 'ca-vancouver',
    country: 'CA',
    city: 'Vancouver',
    region: 'British Columbia',
    coords: [49.2827, -123.1207],
  },
  { slug: 'co-bogota', country: 'CO', city: 'Bogotá', coords: [4.711, -74.0721] },
  { slug: 'de-berlin', country: 'DE', city: 'Berlin', coords: [52.52, 13.405] },
  { slug: 'de-remote', country: 'DE', remote: true },
  { slug: 'es-madrid', country: 'ES', city: 'Madrid', coords: [40.4168, -3.7038] },
  { slug: 'fi-helsinki', country: 'FI', city: 'Helsinki', coords: [60.1699, 24.9384] },
  { slug: 'fr-paris', country: 'FR', city: 'Paris', coords: [48.8566, 2.3522] },
  { slug: 'gb-london', country: 'GB', city: 'London', coords: [51.5074, -0.1278] },
  { slug: 'id-jakarta', country: 'ID', city: 'Jakarta', coords: [-6.2088, 106.8456] },
  {
    slug: 'in-mumbai',
    country: 'IN',
    city: 'Mumbai',
    region: 'Maharashtra',
    coords: [19.076, 72.8777],
  },
  { slug: 'jp-tokyo', country: 'JP', city: 'Tokyo', coords: [35.6762, 139.6503] },
  { slug: 'kr-seoul', country: 'KR', city: 'Seoul', coords: [37.5665, 126.978] },
  { slug: 'mx-mexico-city', country: 'MX', city: 'Mexico City', coords: [19.4326, -99.1332] },
  { slug: 'nl-amsterdam', country: 'NL', city: 'Amsterdam', coords: [52.3676, 4.9041] },
  { slug: 'ph-manila', country: 'PH', city: 'Manila', coords: [14.5995, 120.9842] },
  { slug: 'pl-remote', country: 'PL', remote: true },
  { slug: 'pl-warsaw', country: 'PL', city: 'Warsaw', coords: [52.2297, 21.0122] },
  { slug: 'se-stockholm', country: 'SE', city: 'Stockholm', coords: [59.3293, 18.0686] },
  { slug: 'sg-singapore', country: 'SG', city: 'Singapore', coords: [1.3521, 103.8198] },
  { slug: 'th-bangkok', country: 'TH', city: 'Bangkok', coords: [13.7563, 100.5018] },
  {
    slug: 'tw-hsinchu',
    country: 'TW',
    city: 'Hsinchu',
    region: 'Hsinchu City',
    coords: [24.8138, 120.9675],
    alsoKnownAs: ['tw-east-dist'],
  },
  // Same office written two ways, exactly as Hsinchu above: the board says both
  // 'Taipei City,Taiwan' and 'Xinyi District,Taipei City,Taiwan', and Netflix's
  // Taipei office is the Xinyi one. A separate seed entry would put a second
  // site a couple of kilometres away and split the city in the nearest-sort.
  {
    slug: 'tw-taipei-city',
    country: 'TW',
    city: 'Taipei City',
    coords: [25.033, 121.5654],
    alsoKnownAs: ['tw-xinyi-district'],
  },
  // Plumas County, California -- the board lists it for production roles.
  {
    slug: 'us-beckwourth',
    country: 'US',
    city: 'Beckwourth',
    region: 'California',
    coords: [39.8171, -120.3877],
  },
  {
    slug: 'us-burbank',
    country: 'US',
    city: 'Burbank',
    region: 'California',
    coords: [34.1808, -118.309],
  },
  { slug: 'us-california-remote', country: 'US', region: 'California', remote: true },
  {
    slug: 'us-los-angeles',
    country: 'US',
    city: 'Los Angeles',
    region: 'California',
    coords: [34.0522, -118.2437],
  },
  {
    slug: 'us-los-gatos',
    country: 'US',
    city: 'Los Gatos',
    region: 'California',
    coords: [37.2358, -121.9624],
  },
  // The board gives no city, only the state, so this is the state's centre.
  { slug: 'us-new-jersey', country: 'US', city: 'New Jersey', coords: [40.0583, -74.4057] },
  { slug: 'us-new-york', country: 'US', city: 'New York', coords: [40.7128, -74.006] },
  { slug: 'us-remote', country: 'US', remote: true },
  {
    slug: 'us-seattle',
    country: 'US',
    city: 'Seattle',
    region: 'Washington',
    coords: [47.6062, -122.3321],
  },
  {
    slug: 'us-washington-dc',
    country: 'US',
    city: 'Washington DC',
    region: 'District of Columbia',
    coords: [38.9072, -77.0369],
  },
];
