// Eightfold position payload -> public.jobs row.

import {
  customField,
  epochToIso,
  jobUrl,
  positionLocations,
  positionTitle,
  postingDate,
  type Position,
} from './eightfold.ts';
import { htmlToText, normalizeTitle } from './html-text.ts';
import type { JobRow } from './db.ts';

function trimmed(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

export function mapPosition(listed: Position, detail: Position | null): JobRow {
  // Detail wins where present; the list page is the fallback for a failed detail.
  const merged: Position = { ...listed, ...(detail ?? {}) };
  const id = String(merged.id ?? '');
  const title = positionTitle(merged);
  const locations = positionLocations(merged);
  const html = String(merged.job_description ?? '');

  return {
    position_id: id,
    display_job_id: trimmed(merged.display_job_id),
    ats_job_id: trimmed(merged.ats_job_id),
    job_req_id: customField(merged, 'job_req_id'),
    title,
    posting_name: trimmed(merged.posting_name),
    normalized_title: normalizeTitle(title),
    department: trimmed(merged.department),
    business_unit: trimmed(merged.business_unit),
    team: customField(merged, 'team'),
    location: locations.join(' | '),
    locations,
    // The list page carries work_location_option; detail often nulls it out.
    work_location_option: trimmed(merged.work_location_option ?? listed.work_location_option),
    location_flexibility: trimmed(merged.location_flexibility),
    work_type: customField(merged, 'work_type'),
    description_html: html,
    description_text: htmlToText(html),
    apply_url: `${jobUrl(id)}/apply`,
    canonical_url: trimmed(merged.canonicalPositionUrl) ?? jobUrl(id),
    locale: trimmed(merged.locale),
    is_hot: Number(merged.hot ?? 0) > 0,
    is_private: merged.isPrivate === true,
    posting_date: postingDate(merged),
    source_created_at: epochToIso(merged.t_create),
    source_updated_at: epochToIso(merged.t_update),
    raw: merged,
  };
}
