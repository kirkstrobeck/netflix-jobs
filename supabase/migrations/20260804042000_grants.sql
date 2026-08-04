-- RLS policies decide which rows a role sees; table GRANTs decide whether the
-- role may touch the table at all. New tables get neither by default, so the
-- ingestor's service_role writes fail with 42501 without these.

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on table public.jobs to service_role;
grant all privileges on table public.job_locations to service_role;
grant all privileges on table public.ingest_runs to service_role;

grant select on table public.jobs to anon, authenticated;
grant select on table public.job_locations to anon, authenticated;
grant select on table public.ingest_runs to anon, authenticated;
grant select on table public.jobs_active to anon, authenticated, service_role;
