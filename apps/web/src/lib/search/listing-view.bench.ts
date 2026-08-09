import { bench, describe } from "vitest";

import type { Board } from "@/lib/jobs/board";
import { SITE_COLUMNS, type Site } from "@/lib/jobs/site";
import { SUMMARY_COLUMNS, toSummary, type JobRow } from "@/lib/jobs/job-summary";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { EMPTY_QUERY, toggleFacet, withPage } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

/**
 * What one interaction costs, over the real board.
 *
 * `pnpm --filter web bench`, with the local Supabase stack up. It measures the
 * real 481 rows and refuses to run without them: a benchmark over a generated
 * board measures the generator -- title lengths, how many rows carry several
 * locations, how many distinct locations there are to count -- and every one of
 * those is what the work here is proportional to.
 *
 * deriveListing is the whole interaction: filter the board, page it, and count
 * all four facets with their own selections open. Nothing else happens between
 * a click and a repaint except React reconciling ten rows.
 */
const headers = {
  apikey: supabaseAnonKey(),
  Authorization: `Bearer ${supabaseAnonKey()}`,
};

const read = async <T>(path: string): Promise<T> =>
  (await fetch(`${supabaseUrl()}/rest/v1/${path}`, { headers })).json();

const rows = await read<JobRow[]>(
  `jobs?select=${SUMMARY_COLUMNS}&is_active=eq.true` +
    `&order=posting_date.desc.nullslast,position_id.desc&limit=2000`,
);
const sites = await read<Site[]>(`locations?select=${SITE_COLUMNS}&order=slug`);

const BOARD: Board = { sites, jobs: rows.map(toSummary) };

// Cloning defeats the WeakMap in job-index, because a clone is a different key.
// That is the cold pass -- the one filter that happens right after the payload
// is parsed and every row still has to be indexed.
// The site table is NOT cloned with it: the catalog is memoised on that array,
// and cloning it would measure rebuilding a 36-row Map as well, which happens
// once per payload rather than once per interaction.
const clone = (): Board => ({ sites: BOARD.sites, jobs: structuredClone(BOARD.jobs) });

const TEAM = toggleFacet(EMPTY_QUERY, "team", BOARD.jobs[0].team!);
const KEYWORD = { ...EMPTY_QUERY, keywords: ["engineer"] };
const NARROW = { ...TEAM, keywords: ["senior", "engineer"] };

describe(`deriveListing over ${BOARD.jobs.length} rows`, () => {
  // The clone is not free, and it is not part of the interaction. Subtract this
  // from the cold figure below to read the cost of building the index itself.
  bench("baseline: the clone alone, no filtering", () => {
    clone();
  });

  bench("cold: first filter after the payload lands", () => {
    deriveListing(clone(), EMPTY_QUERY);
  });

  bench("warm: unfiltered", () => {
    deriveListing(BOARD, EMPTY_QUERY);
  });

  bench("warm: one facet ticked", () => {
    deriveListing(BOARD, TEAM);
  });

  bench("warm: one keyword", () => {
    deriveListing(BOARD, KEYWORD);
  });

  bench("warm: a facet and two keywords", () => {
    deriveListing(BOARD, NARROW);
  });

  bench("warm: page 25 of 49", () => {
    deriveListing(BOARD, withPage(EMPTY_QUERY, 25));
  });
});
