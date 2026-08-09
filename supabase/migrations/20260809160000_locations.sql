-- Locations as records rather than strings.
--
-- The board writes a posting's location as free text -- 'Los Angeles,California,
-- United States of America', 'USA - Remote', 'California - Remote,United States
-- of America' -- and the same physical office arrives under several spellings
-- ('Vancouver,Canada' and 'Vancouver,British Columbia,Canada' are one place).
-- Parsing happens in the ingestor (packages/ingestor/lib/parse-location.ts);
-- this is where the result lands.

-- One row per SITE, keyed by a slug the parser derives deterministically from
-- the raw string: '{iso2}-{city}' for a place, '{iso2}-remote' or
-- '{iso2}-{region}-remote' for a remote scope. The region is deliberately NOT
-- in a place's slug -- it is data about the site, not its identity -- which is
-- what collapses those two Vancouver spellings onto one row.
--
-- Coordinates come from a curated seed checked in beside the parser. There is
-- no geocoding at runtime: the distinct-site count is in the tens, the board
-- adds one every few months, and an ingest that depended on a geocoder would
-- fail in a new way every time that service did.
create table public.locations (
  slug text primary key,

  -- Null for a remote scope: 'USA - Remote' is a country, not a place in it.
  city text,
  -- Display spelling, from the seed rather than from whichever raw string the
  -- board happened to use ('Mumbai,India' still gets Maharashtra).
  region text,
  country_code char(2) not null,
  country text not null,
  is_remote boolean not null default false,

  -- ONE nullable value, not two. A remote scope has no coordinates, and the
  -- requirement is that nothing downstream can read that absence as latitude 0,
  -- longitude 0 -- a point off the coast of Ghana that would sort nearest to
  -- roughly everyone. Two nullable float columns cannot promise that: any
  -- caller that reaches for `latitude` gets a value that JSON.parse hands over
  -- as null and arithmetic quietly turns into 0. A point is null as a PAIR or
  -- it is two numbers, so there is no half-read of it, and site_distance_km
  -- below is `strict` -- a null argument returns null, never a distance.
  --
  -- (x, y) is (longitude, latitude), the order earthdistance and PostGIS use,
  -- so this stays readable if either is ever switched on. Read it back through
  -- the job_sites view rather than by subscript.
  coords point,

  -- 'Los Gatos, California, United States' / 'Remote, United States'. Composed
  -- at upsert time from the fields above so the app never assembles it.
  display_name text not null,

  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint locations_country_code_ck check (country_code ~ '^[A-Z]{2}$'),

  -- The shape rule, stated once, enforced by the database: remote means a
  -- country and no place and no coordinates; a place means a city and a fix.
  -- A remote row with coordinates, or a site without them, cannot be written.
  constraint locations_remote_shape_ck check (
    (is_remote and city is null and coords is null)
    or (not is_remote and city is not null and coords is not null)
  ),

  constraint locations_coords_range_ck check (
    coords is null
    or (coords[0] between -180 and 180 and coords[1] between -90 and 90)
  ),

  -- 0,0 is what a mis-seeded row looks like, and it is a legal point, so the
  -- range check above would pass it. Null Island is not a Netflix office.
  constraint locations_coords_not_null_island_ck check (
    coords is null or coords <> point(0, 0)
  )
);

create index locations_country_idx on public.locations (country_code);
create index locations_remote_idx on public.locations (is_remote);

-- Great-circle kilometres between two sites.
--
-- `strict` is the load-bearing word: Postgres skips the body entirely when any
-- argument is null and returns null. A remote scope therefore has no distance
-- rather than a distance of zero, and `order by site_distance_km(...) asc nulls
-- last` puts it after every real office instead of ahead of all of them.
create or replace function public.site_distance_km(a point, b point)
returns double precision
language sql
immutable
strict
parallel safe
as $$
  select 6371.0088 * 2 * asin(least(1, sqrt(
    sin(radians(b[1] - a[1]) / 2) ^ 2
    + cos(radians(a[1])) * cos(radians(b[1])) * sin(radians(b[0] - a[0]) / 2) ^ 2
  )));
$$;

-- Re-key the join from the raw string to the site.
--
-- job_locations is derived -- every crawl deletes and rebuilds a posting's rows
-- -- so emptying it to re-key it loses nothing that the next ingest does not
-- put back. `pnpm --filter @netflix-jobs/ingestor relink` rebuilds it from the
-- jobs already in the table, without crawling.
delete from public.job_locations;

drop index if exists public.job_locations_location_idx;
alter table public.job_locations drop constraint job_locations_pkey;
alter table public.job_locations drop column location;

alter table public.job_locations
  add column location_slug text not null
    references public.locations (slug) on update cascade;

alter table public.job_locations
  add constraint job_locations_pkey primary key (job_position_id, location_slug);

create index job_locations_slug_idx on public.job_locations (location_slug);

-- What a posting's sites look like to a reader. Coordinates come back as one
-- object or as null -- never as two columns a caller could take one of.
create view public.job_sites as
  select
    job_locations.job_position_id,
    locations.slug,
    locations.display_name,
    locations.city,
    locations.region,
    locations.country_code,
    locations.country,
    locations.is_remote,
    case
      when locations.coords is null then null
      else jsonb_build_object('lat', locations.coords[1], 'lng', locations.coords[0])
    end as coords
  from public.job_locations job_locations
  join public.locations locations on locations.slug = job_locations.location_slug;

alter table public.locations enable row level security;

create policy "service role can manage locations"
  on public.locations for all to service_role using (true) with check (true);

create policy "public can read locations"
  on public.locations for select to anon, authenticated using (true);

grant all privileges on table public.locations to service_role;
grant select on table public.locations to anon, authenticated;
grant select on table public.job_sites to anon, authenticated, service_role;
grant execute on function public.site_distance_km(point, point)
  to anon, authenticated, service_role;
