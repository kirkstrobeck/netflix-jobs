// Retry policy over the transport layer. Transport selection, headers and the
// single-request mechanics live in transport.ts.

import {
  isBlocked,
  isRateLimited,
  isRetryable,
  send,
  sleep,
} from './transport.ts';

const RETRY_DELAYS_MS = [2_000, 8_000, 20_000, 45_000];
// The reader's free tier rate limits per IP, so a 429 needs a longer, more
// patient ladder than an ordinary transient fault.
const RATE_LIMIT_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 90_000, 120_000];

export type HttpOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
};

export { configureReader, currentTransport, transportCounts } from './transport.ts';
export type { Transport } from './transport.ts';

function delayFor(err: unknown, attempt: number, rateLimitHits: number): number {
  if (isRateLimited(err)) return RATE_LIMIT_DELAYS_MS[rateLimitHits - 1] ?? 120_000;
  // A 403 on direct is a WAF verdict, not a transient fault: go straight to the
  // next attempt, which the transport's demotion may already have rerouted.
  if (isBlocked(err)) return 0;
  return RETRY_DELAYS_MS[attempt - 1] ?? 45_000;
}

export async function fetchJson(
  url: string,
  label: string,
  options: HttpOptions = {},
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const baseAttempts = options.maxAttempts ?? 4;
  const rateLimit = { hits: 0 };

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await send(url, timeoutMs);
    } catch (err) {
      // A rate limit is not a verdict on us, so it gets its own budget rather
      // than burning the attempts reserved for transient faults.
      if (isRateLimited(err)) rateLimit.hits += 1;
      const allowed = baseAttempts + rateLimit.hits;
      const exhausted = attempt >= allowed || rateLimit.hits > RATE_LIMIT_DELAYS_MS.length;
      if (exhausted || !(isRetryable(err) || isBlocked(err))) throw err;

      const delay = delayFor(err, attempt, rateLimit.hits);
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`  ${label}: ${reason} — retry ${attempt} in ${delay}ms`);
      await sleep(delay);
    }
  }
}
