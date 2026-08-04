-- Bulk upsert entry point for the ingestor.
--
-- The ingestor writes over PostgREST rather than a direct pg connection, so
-- "upsert the job and rebuild its exploded locations" needs to be one atomic
-- call. A batch of postings goes in as a jsonb array; the row count comes back.

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
    work_location_option text,
    location_flexibility text,
    work_type text,
    description_html text,
    description_text text,
    apply_url text,
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
    description_text, apply_url, canonical_url, locale, is_hot, is_private,
    posting_date, source_created_at, source_updated_at, raw, last_run_id
  )
  select
    position_id, display_job_id, ats_job_id, job_req_id, title, posting_name,
    normalized_title, department, business_unit, team, coalesce(location, ''),
    coalesce(locations, '{}'), work_location_option, location_flexibility, work_type,
    coalesce(description_html, ''), coalesce(description_text, ''), apply_url,
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
    apply_url = excluded.apply_url,
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

  insert into public.job_locations (job_position_id, location)
  select incoming.position_id, entry
    from _incoming incoming
    cross join lateral unnest(incoming.locations) as entry
   where entry is not null and entry <> ''
  on conflict do nothing;

  return affected;
end;
$$;

-- Marks every job the current run did not touch as gone from the board.
create or replace function public.deactivate_missing_jobs(run uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  affected integer;
begin
  update public.jobs set is_active = false
   where is_active and last_run_id is distinct from run;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.ingest_jobs(jsonb, uuid) from anon, authenticated;
revoke execute on function public.deactivate_missing_jobs(uuid) from anon, authenticated;
grant execute on function public.ingest_jobs(jsonb, uuid) to service_role;
grant execute on function public.deactivate_missing_jobs(uuid) to service_role;
