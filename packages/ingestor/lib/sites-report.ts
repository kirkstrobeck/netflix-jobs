// The one place a site the seed does not cover is announced.
//
// Shared by the crawl and by `relink`, so both say the same thing in the same
// shape. An uncovered site costs a posting one link and nothing else -- the
// posting is stored either way -- which means this report is the ONLY notice
// that anything is missing. It is loud, it names every string, and it counts
// the postings each one costs.

import { tallyUnplaced } from './sites.ts';

export type SiteReport = {
  /** One line for ingest_runs.notes. */
  note: string;
  /** How many distinct raw strings the seed does not cover. */
  unplaced: number;
};

export function reportUnplaced(perJob: string[][]): SiteReport {
  const unplaced = tallyUnplaced(perJob);

  if (unplaced.length === 0) {
    console.log('sites: every location string is covered by the seed');

    return { note: 'sites: all placed', unplaced: 0 };
  }

  console.log(`\n  !! ${unplaced.length} location string(s) not in lib/sites-seed.ts:`);
  for (const miss of unplaced) {
    console.log(`  !! ${JSON.stringify(miss.raw)} x${miss.jobs} -- ${miss.reason}`);
  }
  console.log('  !! those postings are stored, without a link to that site\n');

  return {
    note: `unplaced sites: ${unplaced.map((miss) => `${miss.raw} x${miss.jobs}`).join('; ')}`,
    unplaced: unplaced.length,
  };
}
