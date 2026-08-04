-- Netflix careers board (Eightfold PCS tenant explore.jobs.netflix.net|netflix.com).
-- Shape follows the easytopjobs core-jobs pattern: a wide row per posting, RLS on,
-- trigram indexes for the free-text columns the UI filters against.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- One row per `pnpm ingest` invocation, so a partial or failed crawl is visible
-- in the data rather than only in a log file.
create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'eightfold',
  board text not null default 'explore.jobs.netflix.net|netflix.com',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  listed_count integer not null default 0,
  detail_ok_count integer not null default 0,
  detail_failed_count integer not null default 0,
  upserted_count integer not null default 0,
  deactivated_count integer not null default 0,
  notes text
);

create index ingest_runs_started_idx on public.ingest_runs (started_at desc);

create table public.jobs (
  -- Eightfold's numeric position id; stable across crawls, so it is the key.
  position_id bigint primary key,
  display_job_id text,
  ats_job_id text,
  job_req_id text,

  title text not null,
  posting_name text,
  normalized_title text not null,

  department text,
  business_unit text,
  team text,

  location text not null default '',
  locations text[] not null default '{}',
  work_location_option text,
  location_flexibility text,
  work_type text,

  description_html text not null default '',
  description_text text not null default '',

  apply_url text not null,
  canonical_url text not null,
  locale text,
  is_hot boolean not null default false,
  is_private boolean not null default false,

  posting_date date,
  source_created_at timestamptz,
  source_updated_at timestamptz,

  raw jsonb not null default '{}'::jsonb,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_run_id uuid references public.ingest_runs (id) on delete set null,
  is_active boolean not null default true
);

create index jobs_active_seen_idx on public.jobs (is_active, last_seen_at desc);
create index jobs_department_active_idx on public.jobs (department, is_active);
create index jobs_business_unit_active_idx on public.jobs (business_unit, is_active);
create index jobs_work_location_active_idx on public.jobs (work_location_option, is_active);
create index jobs_posting_date_idx on public.jobs (posting_date desc nulls last);
create index jobs_locations_gin_idx on public.jobs using gin (locations);
create index jobs_title_trgm_idx on public.jobs using gin (title gin_trgm_ops);
create index jobs_location_trgm_idx on public.jobs using gin (location gin_trgm_ops);
create index jobs_description_trgm_idx on public.jobs using gin (description_text gin_trgm_ops);

-- Locations arrive as an array per posting; the exploded table keeps
-- "how many openings in Los Angeles" a plain group-by.
create table public.job_locations (
  job_position_id bigint not null references public.jobs (position_id) on delete cascade,
  location text not null,
  primary key (job_position_id, location)
);

create index job_locations_location_idx on public.job_locations (location);

create view public.jobs_active as
  select
    position_id,
    display_job_id,
    title,
    department,
    business_unit,
    location,
    locations,
    work_location_option,
    work_type,
    posting_date,
    canonical_url,
    length(description_text) as description_chars,
    last_seen_at
  from public.jobs
  where is_active;

alter table public.jobs enable row level security;
alter table public.job_locations enable row level security;
alter table public.ingest_runs enable row level security;

create policy "service role can manage jobs"
  on public.jobs for all to service_role using (true) with check (true);

create policy "service role can manage job_locations"
  on public.job_locations for all to service_role using (true) with check (true);

create policy "service role can manage ingest_runs"
  on public.ingest_runs for all to service_role using (true) with check (true);

-- The board itself is public, so the mirror is readable without auth.
create policy "public can read active jobs"
  on public.jobs for select to anon, authenticated using (is_active);

create policy "public can read job_locations"
  on public.job_locations for select to anon, authenticated using (true);

create policy "public can read ingest_runs"
  on public.ingest_runs for select to anon, authenticated using (true);
