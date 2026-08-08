// The subset of a job the listing needs: enough for a result row, a facet
// value, and a keyword match. Deliberately NOT the full Job -- description_text
// alone is 2.8MB across the board against 145KB for every column below, and the
// listing caches the whole board in one entry so it can count facets exactly.
export type JobSummary = {
  position_id: number;
  display_job_id: string | null;
  title: string;
  team: string | null;
  location: string;
  locations: string[];
  work_type: string | null;
  posting_date: string | null;
};

export const SUMMARY_COLUMNS = [
  "position_id",
  "display_job_id",
  "title",
  "team",
  "location",
  "locations",
  "work_type",
  "posting_date",
].join(",");

// `locations` is NOT NULL with a '{}' default, so a row with no array falls back
// to the scalar column. Every facet and filter reads locations through here, so
// the two-column arrangement is handled once rather than at each call site.
export function jobLocations(job: JobSummary): string[] {
  if (job.locations.length > 0) {
    return job.locations;
  }

  return job.location ? [job.location] : [];
}
