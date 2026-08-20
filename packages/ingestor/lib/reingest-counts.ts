export type DbCounts = {
  activeRoles: number;
  locationLinks: number;
  rolesWithCoords: number;
};

function authHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'count=exact',
    Range: '0-0',
  };
}

export async function fetchCount(url: string, key: string, path: string): Promise<number> {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: authHeaders(key) });
  if (!res.ok && res.status !== 206) {
    throw new Error(`count query failed (${res.status}): ${url}/rest/v1/${path}`);
  }
  const range = res.headers.get('content-range') ?? '';
  const total = Number(range.split('/')[1]);
  if (!Number.isFinite(total)) {
    throw new Error(`unparseable content-range: "${range}" from ${path}`);
  }
  return total;
}

// Roles with at least one geolocated site: !inner join restricts to jobs that
// have a matching job_location row pointing to a location with coords set.
const COORDS_PATH =
  'jobs?is_active=eq.true' +
  '&select=position_id,job_locations!inner(locations!inner(coords))' +
  '&job_locations.locations.coords=not.is.null';

export async function queryCounts(url: string, key: string): Promise<DbCounts> {
  const [activeRoles, locationLinks, rolesWithCoords] = await Promise.all([
    fetchCount(url, key, 'jobs?is_active=eq.true&select=position_id'),
    fetchCount(
      url,
      key,
      'job_locations?select=location_slug,jobs!inner(is_active)&jobs.is_active=eq.true',
    ),
    fetchCount(url, key, COORDS_PATH),
  ]);
  return { activeRoles, locationLinks, rolesWithCoords };
}
