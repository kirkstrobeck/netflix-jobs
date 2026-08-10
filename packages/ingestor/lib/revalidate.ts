// The crawl writes rows; the web app caches renders. Nothing in Supabase can
// invalidate a Next cache entry, so the last act of a successful run is to tell
// the web app the board moved: POST /api/revalidate -> revalidateTag.
//
// Everything here fails soft, on purpose. By the time this runs the data is
// already committed, so a web app that is down, unreachable or misconfigured
// must not turn a good crawl into a failed one. It gets logged loudly instead --
// the visible symptom of a missed call is a board that keeps showing the
// previous crawl until the cache profile in next.config.ts expires it, which is
// a week away, and nothing else in the pipeline would ever mention it.

const DEFAULT_URL = 'http://127.0.0.1:3000/api/revalidate';

// Bounded so a web app that accepts the connection and then hangs cannot pin an
// otherwise finished ingest open indefinitely.
const TIMEOUT_MS = 10_000;

export type RevalidateOutcome = 'ok' | 'skipped' | 'failed';

export function revalidateUrl(): string {
  return process.env.REVALIDATE_URL ?? DEFAULT_URL;
}

function failed(reason: string): RevalidateOutcome {
  console.error(`  REVALIDATE FAILED: ${reason}`);
  console.error(
    '  The crawl is written. The web app will keep serving its cached copy until it is revalidated or the cache expires.',
  );

  return 'failed';
}

async function send(
  url: string,
  secret: string,
  jobIds: string[],
  board: boolean,
): Promise<RevalidateOutcome> {
  // Both stated outright, never left to the endpoint's default. The board tag no
  // longer rides along on a posting's page, so "flush these ids" and "flush the
  // listing" are two independent answers and the caller has computed each.
  const body = { jobIds, board };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = (await res.text()).slice(0, 300);
  if (!res.ok) return failed(`POST ${url} -> ${res.status}: ${text}`);

  console.log(`  revalidated ${url}: ${text}`);
  return 'ok';
}

export async function revalidateWeb(
  jobIds: string[] = [],
  board = true,
): Promise<RevalidateOutcome> {
  const secret = process.env.REVALIDATE_SECRET;

  // Skipped rather than attempted unauthenticated: the endpoint answers 401 to
  // an unsigned call, so posting one would only trade a clear warning for a
  // confusing failure.
  if (!secret) {
    console.warn(
      '  WARNING: REVALIDATE_SECRET is unset -- skipping cache revalidation. The web app will serve the previous crawl until its cache expires.',
    );

    return 'skipped';
  }

  try {
    return await send(revalidateUrl(), secret, jobIds, board);
  } catch (err) {
    return failed(`POST ${revalidateUrl()}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
