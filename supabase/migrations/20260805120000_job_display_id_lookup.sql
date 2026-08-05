-- The public URL key is the Netflix job code (display_job_id: AJRT30201,
-- JR41912), not position_id. position_id stays the primary key and the foreign
-- key job_locations points at; this migration only makes the code addressable.

-- Case-insensitive uniqueness is now a correctness requirement, not a nicety:
-- /jobs/ajrt30201 and /jobs/AJRT30201 must resolve to one job, so two rows
-- differing only by case would make the URL ambiguous. This unique index
-- enforces that, and it is also the index the lookup below plans against --
-- upper(text) is IMMUTABLE, so `where upper(display_job_id) = upper($1)` is an
-- index scan rather than a sequential scan over all 481 rows.
create unique index jobs_display_job_id_upper_key
  on public.jobs (upper(display_job_id));

-- PostgREST cannot express `where upper(col) = upper($1)` as a column filter.
-- The alternatives are worse: an `ilike` filter ignores this index and would
-- treat % and _ arriving in the URL path as wildcards, and matching on the raw
-- column would depend on every future crawl continuing to store the code
-- uppercase. A `stable` function is callable over GET, so the web app's
-- read-only REST client reaches it without gaining a POST verb.
--
-- security invoker (the default, stated for the record) keeps the caller's RLS
-- in force, so anon still only sees rows where is_active.
create or replace function public.job_by_display_id(p_display_id text)
returns setof public.jobs
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.jobs
  where upper(display_job_id) = upper(p_display_id)
  limit 1;
$$;

grant execute on function public.job_by_display_id(text)
  to anon, authenticated, service_role;
