/**
 * EVERY DATABASE-DERIVED NUMBER ON /about, PINNED TO THE SOURCE IT CAME FROM.
 *
 * This file exists because about.test.tsx does not do this and its docstring
 * used to claim it did. That file asserts structure and wording -- five claims,
 * a heading per group, sentence case, no first person -- all of which stayed
 * green while the board grew from 479 postings to 480 and the copy went on
 * saying 479. Prose tests cannot catch a rotted measurement. Only re-measuring
 * can.
 *
 * SO THIS ONE TALKS TO THE DATABASE, ON PURPOSE.
 *
 * It is not a unit test and does not pretend to be. It reads the real board over
 * the real PostgREST endpoint, with the app's own SUMMARY_COLUMNS and
 * SITE_COLUMNS and the app's own is_active predicate, then derives each figure
 * with the app's own functions -- toSummary, siteCatalog, facetOptions -- rather
 * than with arithmetic written here that could drift from what the listing
 * actually counts. A number that agrees with a reimplementation of the query is
 * not pinned to anything.
 *
 * The cost is that the suite needs the local Supabase stack up, and that a crawl
 * which changes the board turns this red. Both are the point. Red here means the
 * page is lying to a reader, and the fix is to correct the sentence, not the
 * test.
 *
 * WHAT IS DELIBERATELY NOT PINNED HERE
 *
 * The test count, the Lighthouse scores, the render-blocking byte count, the
 * frame rate and the tab stops. None of them are database facts. The test count
 * in particular is asserted NOWHERE and is hand maintained on purpose: a suite
 * that asserted its own size would change that size by existing, fail on the
 * commit that added it, and have to be edited to agree with itself every time
 * any other test was written. See the note in about-copy.ts.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { GROUPS } from "@/app/(site)/about/about-copy";
import { siteCatalog, type SiteCatalog } from "@/lib/jobs/board";
import { SUMMARY_COLUMNS, toSummary, type JobRow, type JobSummary } from "@/lib/jobs/job-summary";
import { SITE_COLUMNS, type Site } from "@/lib/jobs/site";
import { facetOptions } from "@/lib/search/facet-counts";
import { readSearchParams } from "@/lib/search/parse-query";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/** The points of one group, as the page renders them. */
const points = (id: string): readonly string[] => {
  const group = GROUPS.find((candidate) => candidate.id === id);

  if (!group) {
    throw new Error(`/about has no "${id}" group`);
  }

  return group.points;
};

const read = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${supabaseAnonKey()}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Supabase said ${response.status} for ${path}. The local stack has to be up ` +
        `for this file: pnpm db:start, then pnpm ingest.`,
    );
  }

  return response.json() as Promise<T>;
};

/** The coordinate column, which SITE_COLUMNS deliberately does not carry. */
type Coords = { slug: string; is_remote: boolean; coords: string | null };

let jobs: JobSummary[];
let sites: Site[];
let coords: Coords[];
let catalog: SiteCatalog;

beforeAll(async () => {
  // The listing's own query, character for character -- lib/jobs/list-jobs.ts.
  const rows = await read<JobRow[]>(
    `jobs?select=${SUMMARY_COLUMNS}&is_active=eq.true` +
      `&order=posting_date.desc.nullslast,position_id.desc&limit=2000`,
  );

  jobs = rows.map(toSummary);
  sites = await read<Site[]>(`locations?select=${SITE_COLUMNS}&order=slug`);
  coords = await read<Coords[]>(`locations?select=slug,is_remote,coords&order=slug`);
  catalog = siteCatalog(sites);
}, 30_000);

describe("what /about says about the board", () => {
  it("states the number of active roles the listing would load", () => {
    expect(points("location")).toContain(
      `All ${jobs.length} active roles resolve to a site record`,
    );
  });

  // The sentence says "All", so the count is only half of it. This is the other
  // half: every posting really does resolve, and to a slug the catalog holds.
  it("is telling the truth about ALL of them resolving", () => {
    const unresolved = jobs.filter(
      (job) => job.sites.length === 0 || job.sites.some((slug) => !catalog.bySlug.has(slug)),
    );

    expect(unresolved.map((job) => job.display_job_id)).toEqual([]);
  });

  it("states the number of location links those roles resolve to", () => {
    const links = jobs.reduce((total, job) => total + job.sites.length, 0);

    expect(points("location")).toContain(
      `The ${jobs.length} roles resolve to ${links} location links`,
    );
  });

  /**
   * Against public.locations.coords, not against is_remote.
   *
   * The app never sees the column: SITE_COLUMNS stops at is_remote, and
   * locations_remote_shape_ck in the locations migration makes the two
   * equivalent by constraint. The claim is about coordinates, so it is checked
   * against coordinates -- and the equivalence the app leans on is checked too,
   * because if the constraint were ever dropped this page would be the last
   * place anyone noticed.
   */
  it("states how many sites carry coordinates", () => {
    const carrying = coords.filter((site) => site.coords !== null);
    const without = coords.filter((site) => site.coords === null);

    expect(points("location")).toContain(
      `${carrying.length} of the ${coords.length} sites carry coordinates; ` +
        `the ${without.length} without them are the remote sites`,
    );
    expect(without.every((site) => site.is_remote)).toBe(true);
    expect(carrying.every((site) => !site.is_remote)).toBe(true);
  });

  it("states how many roles reach a site with coordinates", () => {
    const located = new Set(
      coords.filter((site) => site.coords !== null).map((site) => site.slug),
    );
    const reached = jobs.filter((job) => job.sites.some((slug) => located.has(slug)));

    expect(points("location")).toContain(
      `${reached.length} roles resolve to at least one site with coordinates`,
    );
  });
});

describe("what /about says about filtering", () => {
  // Through facetOptions, which is what the panel renders from -- so these are
  // the numbers a visitor would read off the screen, including its rule that a
  // facet counts with its own selection left open.
  const count = (search: string, key: "country" | "site", label: string): number => {
    const option = facetOptions(
      jobs,
      readSearchParams(new URLSearchParams(search)),
      key,
      catalog,
    ).find((candidate) => candidate.label === label);

    if (!option) {
      throw new Error(`no ${key} option labelled "${label}"`);
    }

    return option.count;
  };

  it("states what selecting Remote does to the United States and Los Angeles", () => {
    const country = "United States";
    const site = "Los Angeles, California";

    expect(points("filtering")).toContain(
      `Filters apply across groups: select Remote and United States goes from ` +
        `${count("", "country", country)} to ${count("type=Remote", "country", country)}, ` +
        `Los Angeles from ${count("", "site", site)} to ${count("type=Remote", "site", site)}`,
    );
  });
});
