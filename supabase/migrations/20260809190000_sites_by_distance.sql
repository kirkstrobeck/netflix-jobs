-- "Which offices are near this point, and how near?"
--
-- The distance itself already exists as public.site_distance_km, and it is
-- `strict` on purpose: a remote scope has no coordinates, so it has no distance
-- rather than a distance of zero (see 20260809160000_locations.sql). This is the
-- only thing missing to use it -- a callable entry point, because PostgREST can
-- filter and order by columns but cannot invoke a two-argument function against
-- a point supplied by the caller.
--
-- Lat and lng arrive as plain numbers rather than as a point because that is
-- what a JSON body can carry without a cast, and point(x, y) is (lng, lat) --
-- the order earthdistance and PostGIS use, and the order the coords column is
-- stored in. Doing the swap HERE, once, is what stops every caller having to
-- remember it.
--
-- `where coords is not null` rather than letting the strict function return
-- null: a row with no distance is not a far-away office, it is a scope that the
-- question does not apply to. Omitting it from the result is the only answer
-- that cannot be misread downstream as "very far" or, worse, as zero. The
-- listing decides where those roles go; this function does not have an opinion,
-- because it has no coordinates to have one with.
--
-- stable, not immutable: the answer depends on the locations table, which the
-- ingestor rewrites. stable is also what lets PostgREST accept the call at all
-- from a read-only role.
create or replace function public.sites_by_distance(
  lat double precision,
  lng double precision
)
returns table (slug text, distance_km double precision)
language sql
stable
parallel safe
as $$
  select
    locations.slug,
    public.site_distance_km(locations.coords, point(lng, lat))
  from public.locations locations
  where locations.coords is not null;
$$;

grant execute on function public.sites_by_distance(double precision, double precision)
  to anon, authenticated, service_role;
