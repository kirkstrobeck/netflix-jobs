// The subset of a job the listing needs: enough for a result row, a facet
// value, and a keyword match. Deliberately NOT the full Job -- description_text
// alone is 2.8MB across the board against 145KB for every column below, and the
// listing caches the whole board in one entry so it can count facets exactly.
export type JobSummary = {
  position_id: number;
  display_job_id: string | null;
  title: string;
  team: string | null;
  /** Three values across the whole board -- see JobQuery.businessUnit. */
  business_unit: string | null;
  /**
   * public.locations slugs, sorted. The raw `location` / `locations[]` strings
   * the board writes are NOT here: 'Los Angeles,California,United States of
   * America' spells the same site five different ways across the crawl, and
   * every question the listing asks -- which country, which office, is it
   * remote -- is a question about the site record, not about the string. The
   * slugs resolve against Board.sites.
   */
  sites: string[];
  work_type: string | null;
  posting_date: string | null;
};

export const SUMMARY_COLUMNS = [
  "position_id",
  "display_job_id",
  "title",
  "team",
  // 428 of 481 rows say "Streaming", so the column costs the payload almost
  // nothing once it is compressed -- the repetition is what gzip is best at.
  "business_unit",
  "work_type",
  "posting_date",
  // The join, embedded rather than fetched separately: PostgREST resolves it
  // from the foreign key on job_locations.job_position_id, so 670 rows arrive
  // with the postings they belong to instead of as a second round trip that
  // could be one crawl out of step with the first.
  "job_locations(location_slug)",
].join(",");

/** A posting as PostgREST returns it, with the join still nested. */
export type JobRow = Omit<JobSummary, "sites"> & {
  job_locations: { location_slug: string }[];
};

// Sorted, because PostgREST does not promise an order for an embedded resource
// and boardVersion() is a digest of these exact bytes -- an unordered array
// would change the digest, and therefore bust every browser's copy of the
// board, on a crawl that changed nothing.
export function toSummary(row: JobRow): JobSummary {
  const { job_locations: joined, ...job } = row;

  return {
    ...job,
    sites: joined.map((entry) => entry.location_slug).sort(),
  };
}
