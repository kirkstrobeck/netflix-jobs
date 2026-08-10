-- jobs.apply_url goes away. It was never crawled data.
--
-- The ingestor synthesised it as `<board>/careers/job/<pid>/apply` and stored a
-- copy on all 478 active rows. Netflix does not serve that path: measured 404
-- on 2026-08-10, against the live board, for every posting. The route that
-- works is a query on one fixed path --
--
--   /careers/apply?domain=netflix.com&pid=<position_id>&sort_by=relevance
--
-- -- which makes the whole value a pure function of position_id, this table's
-- primary key. Storing it bought nothing and cost the outage: correcting a
-- column needs a re-crawl, and the crawl has no scheduled runner, so a stale
-- row keeps serving a dead link until a human runs the ingestor.
--
-- It is therefore derived at render time now, in
-- apps/web/src/lib/jobs/apply-url.ts, and there is nothing here to drift.
--
-- This also drops it from packages/ingestor/lib/checksum.ts's content digest,
-- so the next crawl sees every content_checksum move once and flushes every job
-- page. That flush is correct rather than incidental: the apply href on all of
-- them really did change.

-- Replaced before the column goes, so no version of this function ever names a
-- column that is not there.
create or replace function public.ingest_jobs(payload jsonb, run uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  affected integer;
begin
  create temporary table _incoming on commit drop as
  select * from jsonb_to_recordset(payload) as x(
    position_id bigint,
    display_job_id text,
    ats_job_id text,
    job_req_id text,
    title text,
    posting_name text,
    normalized_title text,
    department text,
    business_unit text,
    team text,
    location text,
    locations text[],
    location_slugs text[],
    work_location_option text,
    location_flexibility text,
    work_type text,
    description_html text,
    description_text text,
    canonical_url text,
    locale text,
    is_hot boolean,
    is_private boolean,
    posting_date date,
    source_created_at timestamptz,
    source_updated_at timestamptz,
    raw jsonb
  );

  insert into public.jobs (
    position_id, display_job_id, ats_job_id, job_req_id, title, posting_name,
    normalized_title, department, business_unit, team, location, locations,
    work_location_option, location_flexibility, work_type, description_html,
    description_text, canonical_url, locale, is_hot, is_private,
    posting_date, source_created_at, source_updated_at, raw, last_run_id
  )
  select
    position_id, display_job_id, ats_job_id, job_req_id, title, posting_name,
    normalized_title, department, business_unit, team, coalesce(location, ''),
    coalesce(locations, '{}'), work_location_option, location_flexibility, work_type,
    coalesce(description_html, ''), coalesce(description_text, ''),
    canonical_url, locale, coalesce(is_hot, false), coalesce(is_private, false),
    posting_date, source_created_at, source_updated_at, coalesce(raw, '{}'::jsonb), run
  from _incoming
  on conflict (position_id) do update set
    display_job_id = excluded.display_job_id,
    ats_job_id = excluded.ats_job_id,
    job_req_id = excluded.job_req_id,
    title = excluded.title,
    posting_name = excluded.posting_name,
    normalized_title = excluded.normalized_title,
    department = excluded.department,
    business_unit = excluded.business_unit,
    team = excluded.team,
    location = excluded.location,
    locations = excluded.locations,
    work_location_option = excluded.work_location_option,
    location_flexibility = excluded.location_flexibility,
    work_type = excluded.work_type,
    description_html = excluded.description_html,
    description_text = excluded.description_text,
    canonical_url = excluded.canonical_url,
    locale = excluded.locale,
    is_hot = excluded.is_hot,
    is_private = excluded.is_private,
    posting_date = excluded.posting_date,
    source_created_at = excluded.source_created_at,
    source_updated_at = excluded.source_updated_at,
    raw = excluded.raw,
    last_run_id = excluded.last_run_id,
    last_seen_at = now(),
    is_active = true;

  get diagnostics affected = row_count;

  -- Rebuild rather than merge: a posting can lose a location between crawls.
  delete from public.job_locations
   where job_position_id in (select position_id from _incoming);

  insert into public.job_locations (job_position_id, location_slug)
  select incoming.position_id, entry
    from _incoming incoming
    cross join lateral unnest(coalesce(incoming.location_slugs, '{}')) as entry
   where entry is not null and entry <> ''
  on conflict do nothing;

  return affected;
end;
$$;

revoke execute on function public.ingest_jobs(jsonb, uuid) from anon, authenticated;
grant execute on function public.ingest_jobs(jsonb, uuid) to service_role;

alter table public.jobs drop column apply_url;
