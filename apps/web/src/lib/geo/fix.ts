/**
 * A position, as a PAIR.
 *
 * The same rule the locations table enforces in SQL, restated in TypeScript:
 * there is one value, and it is either two numbers or it is absent. Two
 * optional fields would let a caller read a latitude and get a longitude of
 * undefined, which arithmetic turns into 0 -- and 0,0 is a point in the Gulf of
 * Guinea that would sort nearest to roughly everyone.
 */
export type Fix = { lat: number; lng: number };

/**
 * Two decimal places, about 1.1km at the equator and less everywhere else.
 *
 * The number that leaves the browser is deliberately coarser than the number
 * the browser has. Sorting buckets at 50km, so 1.1km cannot change the answer
 * except for a visitor sitting within about a kilometre of a bucket boundary --
 * and in exchange the server is never told, and never logs, where anyone
 * actually is. The precision that is not needed is dropped at the only point
 * where dropping it is still our decision to make.
 */
export function coarsen(fix: Fix): Fix {
  return {
    lat: Math.round(fix.lat * 100) / 100,
    lng: Math.round(fix.lng * 100) / 100,
  };
}

function inRange(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

/**
 * Whatever arrived over the wire, if it is a position.
 *
 * The route handler is a public endpoint, so this is the boundary where a body
 * stops being `unknown`. The ranges are the ones locations_coords_range_ck
 * checks in the database, applied here as well so a nonsense pair is a 400
 * rather than a round trip that returns a table of distances to a point that
 * cannot exist.
 */
export function parseFix(body: unknown): Fix | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { lat, lng } = body as { lat?: unknown; lng?: unknown };

  if (!inRange(lat, 90) || !inRange(lng, 180)) {
    return null;
  }

  return { lat, lng };
}
