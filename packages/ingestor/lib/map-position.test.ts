import { describe, expect, it } from 'vitest';

import { mapPosition } from './map-position.ts';
import type { Position } from './eightfold.ts';

const listed: Position = {
  id: 790123,
  name: 'Software Engineer (L5)',
  location: 'Los Gatos, CA',
  work_location_option: 'hybrid',
  display_job_id: 'JR1234',
};

describe('mapPosition', () => {
  it('lets the detail payload override the list payload', () => {
    const detail: Position = {
      id: 790123,
      name: 'Senior Software Engineer',
      locations: ['Los Gatos, CA', 'Remote, US'],
      job_description: '<p>Build <b>things</b>.</p>',
      department: 'Engineering',
      business_unit: 'Product',
      locale: 'en-US',
      canonicalPositionUrl: 'https://jobs.netflix.com/jobs/790123',
      t_create: 1_700_000_000,
      t_update: 1_700_086_400,
      custom_JD: {
        data_fields: {
          job_req_id: ['REQ-9'],
          team: ['Ads Engineering'],
          work_type: ['Full Time'],
          posting_date: ['03-27-2025'],
        },
      },
    };

    const row = mapPosition(listed, detail);

    expect(row.position_id).toBe('790123');
    expect(row.title).toBe('Senior Software Engineer');
    expect(row.normalized_title).toBe('senior software engineer');
    expect(row.locations).toEqual(['Los Gatos, CA', 'Remote, US']);
    expect(row.location).toBe('Los Gatos, CA | Remote, US');
    expect(row.description_html).toBe('<p>Build <b>things</b>.</p>');
    expect(row.description_text).toBe('Build things.');
    expect(row.department).toBe('Engineering');
    expect(row.business_unit).toBe('Product');
    expect(row.job_req_id).toBe('REQ-9');
    expect(row.team).toBe('Ads Engineering');
    expect(row.work_type).toBe('Full Time');
    expect(row.posting_date).toBe('2025-03-27');
    expect(row.locale).toBe('en-US');
    expect(row.canonical_url).toBe('https://jobs.netflix.com/jobs/790123');
    expect(row.apply_url).toBe('https://explore.jobs.netflix.net/careers/job/790123/apply');
    expect(row.source_created_at).toBe('2023-11-14T22:13:20.000Z');
    expect(row.source_updated_at).toBe('2023-11-15T22:13:20.000Z');
    expect(row.display_job_id).toBe('JR1234');
    expect(row.raw).toEqual({ ...listed, ...detail });
  });

  it('falls back to the list payload when the detail fetch failed', () => {
    const row = mapPosition(listed, null);

    expect(row.position_id).toBe('790123');
    expect(row.title).toBe('Software Engineer (L5)');
    expect(row.locations).toEqual(['Los Gatos, CA']);
    expect(row.location).toBe('Los Gatos, CA');
    // No description survived, which is how a soft detail failure shows up.
    expect(row.description_html).toBe('');
    expect(row.description_text).toBe('');
    expect(row.canonical_url).toBe('https://explore.jobs.netflix.net/careers/job/790123');
    expect(row.raw).toEqual(listed);
  });

  it('maps empty and whitespace-only strings to null', () => {
    const row = mapPosition(
      {
        id: 1,
        name: 'Role',
        display_job_id: '',
        ats_job_id: '   ',
        posting_name: '',
        department: '',
        business_unit: '   ',
        locale: '',
        location_flexibility: '',
        work_location_option: '',
        canonicalPositionUrl: '   ',
      },
      null,
    );

    expect(row.display_job_id).toBeNull();
    expect(row.ats_job_id).toBeNull();
    expect(row.posting_name).toBeNull();
    expect(row.department).toBeNull();
    expect(row.business_unit).toBeNull();
    expect(row.locale).toBeNull();
    expect(row.location_flexibility).toBeNull();
    expect(row.work_location_option).toBeNull();
    // A blank canonical url falls back to the derived job url.
    expect(row.canonical_url).toBe('https://explore.jobs.netflix.net/careers/job/1');
  });

  it('maps absent fields to null and derives defaults', () => {
    const row = mapPosition({}, null);

    expect(row.position_id).toBe('');
    expect(row.title).toBe('');
    expect(row.normalized_title).toBe('');
    expect(row.locations).toEqual([]);
    expect(row.location).toBe('');
    expect(row.job_req_id).toBeNull();
    expect(row.team).toBeNull();
    expect(row.work_type).toBeNull();
    expect(row.posting_date).toBeNull();
    expect(row.source_created_at).toBeNull();
    expect(row.source_updated_at).toBeNull();
    expect(row.is_hot).toBe(false);
    expect(row.is_private).toBe(false);
  });

  it('derives is_hot from a positive hot counter', () => {
    expect(mapPosition({ id: 1, hot: 1 }, null).is_hot).toBe(true);
    expect(mapPosition({ id: 1, hot: 5 }, null).is_hot).toBe(true);
    expect(mapPosition({ id: 1, hot: 0 }, null).is_hot).toBe(false);
    expect(mapPosition({ id: 1 }, null).is_hot).toBe(false);
  });

  it('treats is_private as strictly boolean true', () => {
    expect(mapPosition({ id: 1, isPrivate: true }, null).is_private).toBe(true);
    expect(mapPosition({ id: 1, isPrivate: false }, null).is_private).toBe(false);
    expect(mapPosition({ id: 1, isPrivate: 'true' as never }, null).is_private).toBe(false);
  });

  it('recovers work_location_option from the list page when detail nulls it', () => {
    const detail: Position = { id: 790123, name: 'Role', work_location_option: null };
    expect(mapPosition(listed, detail).work_location_option).toBe('hybrid');
  });

  it('prefers the detail work_location_option when it is present', () => {
    const detail: Position = { id: 790123, name: 'Role', work_location_option: 'remote' };
    expect(mapPosition(listed, detail).work_location_option).toBe('remote');
  });
});
