// Rebuild public.locations and public.job_locations from the postings already
// in the database, without touching the board.
//
//   pnpm --filter @netflix-jobs/ingestor relink
//
// A crawl does this as part of its run; this exists for the times a crawl is
// not what you want. Editing a coordinate or adding a site to lib/sites-seed.ts
// changes nothing about the postings, and re-crawling 481 of them to pick up
// one new line is both slow and, from an egress IP the board's WAF has an
// opinion about, not always possible. It reads jobs.locations -- the raw
// strings, stored exactly as the board sent them -- and re-derives the join.

import { pathToFileURL } from 'node:url';

import { listJobLocations, replaceJobSites, upsertLocations } from '../lib/db.ts';
import { reportUnplaced } from '../lib/sites-report.ts';
import { assignSites, seedRows } from '../lib/sites.ts';

export async function main(
  exit: (code: number) => void = (code) => process.exit(code),
): Promise<void> {
  const seeded = await upsertLocations(seedRows());
  console.log(`seeded ${seeded} locations`);

  const jobs = await listJobLocations();
  console.log(`read ${jobs.length} postings`);

  const links = jobs.flatMap((job) =>
    assignSites(job.locations).slugs.map((slug) => ({
      job_position_id: job.position_id,
      location_slug: slug,
    })),
  );

  const written = await replaceJobSites(links);
  console.log(`linked ${written} job/site pairs`);

  const report = reportUnplaced(jobs.map((job) => job.locations));

  // Non-zero on an uncovered site: this command exists to be run after editing
  // the seed, and "did that cover everything" is the question it answers.
  exit(report.unplaced === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
