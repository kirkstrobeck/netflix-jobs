import { boardBody } from "@/lib/jobs/board-payload";

// The board as one file, fetched after hydration so the client can filter, sort
// and paginate without asking the server again.
//
// The handler reads NOTHING off the request -- not the query string, not a
// header -- so under Cache Components it prerenders to a single static response
// that every visitor shares, and boardBody()'s own cache entry means a crawl,
// not a request, is what costs a Supabase round trip.
//
// The `?v=` the client appends is therefore ignored here on purpose. It is not
// an input; it is the cache key. Cache-Control on this path is a year and
// `immutable` (see cache-headers.ts), which is only honest because the URL
// changes when the bytes change: revalidateTag flushes the server, and the new
// version in the next server render is what stops a browser reusing the file it
// already has. A bare /api/board with no version is still valid and still
// correct on the day it is fetched -- nothing this app sends asks for it.
export async function GET(): Promise<Response> {
  return new Response(await boardBody(), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
