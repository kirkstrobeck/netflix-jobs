import { describe, expect, it } from 'vitest';

import { boardChecksum, contentChecksum } from './checksum.ts';
import type { JobRow } from './db.ts';

// A row with every column filled, so a test that changes one field is changing
// exactly one thing.
function row(overrides: Partial<JobRow> = {}): JobRow {
  return {
    position_id: '790298014263',
    display_job_id: 'JR41912',
    ats_job_id: null,
    job_req_id: null,
    title: 'Senior Software Engineer',
    posting_name: null,
    normalized_title: 'senior software engineer',
    department: 'Engineering',
    business_unit: 'Streaming',
    team: 'Engineering',
    location: 'Los Gatos,California,United States of America',
    locations: ['Los Gatos,California,United States of America'],
    location_slugs: ['us-los-gatos'],
    work_location_option: 'flexible',
    location_flexibility: null,
    work_type: 'Onsite',
    description_html: '<p>Work here</p>',
    description_text: 'Work here',
    canonical_url: 'https://example.test/job',
    locale: 'en',
    is_hot: false,
    is_private: false,
    posting_date: '2026-08-01',
    source_created_at: '2026-07-30T00:00:00Z',
    source_updated_at: '2026-08-09T00:00:00Z',
    raw: { score: 1 },
    ...overrides,
  };
}

describe('boardChecksum', () => {
  it('is stable across two crawls of an unchanged posting', () => {
    expect(boardChecksum(row())).toBe(boardChecksum(row()));
  });

  // The seven inputs, one at a time. Each of these is something the listing
  // draws or filters on, so each has to move the digest that decides whether
  // hundreds of cached listing URLs are thrown away.
  it.each([
    ['display_job_id', { display_job_id: 'JR41913' }],
    ['title', { title: 'Staff Software Engineer' }],
    ['team', { team: 'Marketing' }],
    ['business_unit', { business_unit: 'Animation' }],
    ['work_type', { work_type: 'Remote' }],
    ['posting_date', { posting_date: '2026-08-02' }],
    ['location_slugs', { location_slugs: ['us-los-angeles'] }],
  ])('moves when %s changes', (_field, change) => {
    expect(boardChecksum(row(change))).not.toBe(boardChecksum(row()));
  });

  // THE WHOLE REASON THE DIGEST IS COMPUTED RATHER THAN READ.
  //
  // Eightfold moves source_updated_at on postings whose rendered content is
  // byte-identical, and `raw` carries counters that move every crawl. Digesting
  // the row would report "everything changed" on every run, which is precisely
  // the behaviour the checksums replace.
  it.each([
    ['source_updated_at', { source_updated_at: '2026-08-10T00:00:00Z' }],
    ['raw', { raw: { score: 99 } }],
    ['is_hot', { is_hot: true }],
    ['normalized_title', { normalized_title: 'something else' }],
    // Selected by get-job.ts and rendered by nothing.
    ['work_location_option', { work_location_option: 'onsite' }],
    // Rendered on a posting's own page, and nowhere on the board.
    ['department', { department: 'Product' }],
    ['description_html', { description_html: '<p>Rewritten</p>' }],
  ])('does NOT move when %s changes', (_field, change) => {
    expect(boardChecksum(row(change))).toBe(boardChecksum(row()));
  });

  // PostgREST does not promise an order for these arrays, and a re-ordered
  // array is not a changed posting.
  it('ignores the order of the location slugs', () => {
    const one = boardChecksum(row({ location_slugs: ['us-los-gatos', 'us-new-york'] }));
    const other = boardChecksum(row({ location_slugs: ['us-new-york', 'us-los-gatos'] }));

    expect(one).toBe(other);
  });

  // The page renders "Not listed" for both, so they are the same screen.
  it('reads a null column and an empty one as the same thing', () => {
    expect(boardChecksum(row({ team: null }))).toBe(boardChecksum(row({ team: '' })));
  });
});

describe('contentChecksum', () => {
  it('is stable across two crawls of an unchanged posting', () => {
    expect(contentChecksum(row())).toBe(contentChecksum(row()));
  });

  // A superset: everything the board's digest covers, plus what only the
  // posting's own page renders.
  it.each([
    ['title', { title: 'Staff Software Engineer' }],
    ['department', { department: 'Product' }],
    ['location', { location: 'Remote,United States of America' }],
    ['locations', { locations: ['Remote,United States of America'] }],
    ['description_html', { description_html: '<p>Rewritten</p>' }],
    ['description_text', { description_text: 'Rewritten' }],
    ['canonical_url', { canonical_url: 'https://example.test/job-2' }],
    ['source_created_at', { source_created_at: '2026-07-31T00:00:00Z' }],
  ])('moves when %s changes', (_field, change) => {
    expect(contentChecksum(row(change))).not.toBe(contentChecksum(row()));
  });

  it.each([
    ['source_updated_at', { source_updated_at: '2026-08-10T00:00:00Z' }],
    ['raw', { raw: { score: 99 } }],
    ['work_location_option', { work_location_option: 'onsite' }],
  ])('does NOT move when %s changes', (_field, change) => {
    expect(contentChecksum(row(change))).toBe(contentChecksum(row()));
  });

  it('is not the same string as the board digest', () => {
    expect(contentChecksum(row())).not.toBe(boardChecksum(row()));
  });
});
