// Picks how to reach the Eightfold endpoints, and sends one request.
//
// Netflix fronts explore.jobs.netflix.net with CloudFront + AWS WAF. From some
// egress IPs every path on the host answers 403 "Request blocked" — including
// robots.txt — regardless of user agent or TLS fingerprint. So there are two
// transports and the module prefers whichever is currently working:
//
//   direct — plain fetch, fast, no third party
//   reader — r.jina.ai raw passthrough, works from a blocked IP, rate limited
//
// It starts on `direct`, demotes to `reader` after a run of 403s, and re-probes
// `direct` every RETRY_DIRECT_AFTER requests so a lifted block speeds the run up.

import { createSemaphore } from './semaphore.ts';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
];

const READER_PREFIX = 'https://r.jina.ai/';
const BLOCK_STREAK_TO_DEMOTE = 3;
const RETRY_DIRECT_AFTER = 50;

export type Transport = 'direct' | 'reader';

export class HttpError extends Error {
  status: number;
  constructor(status: number, label: string) {
    super(`${label}: HTTP ${status}`);
    this.status = status;
  }
}

export function isBlocked(err: unknown): boolean {
  return err instanceof HttpError && err.status === 403;
}

export function isRateLimited(err: unknown): boolean {
  return err instanceof HttpError && err.status === 429;
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return [429, 500, 502, 503, 504].includes(err.status);
  return true; // network / abort errors
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const state = {
  transport: 'direct' as Transport,
  blockStreak: 0,
  sinceDirectProbe: 0,
  readerNextAt: 0,
  counts: { direct: 0, reader: 0 },
};

const readerGate = { semaphore: createSemaphore(2), spacingMs: 1_200 };

export function configureReader(concurrency: number, spacingMs: number): void {
  readerGate.semaphore = createSemaphore(concurrency);
  readerGate.spacingMs = spacingMs;
}

export function transportCounts(): { direct: number; reader: number } {
  return { ...state.counts };
}

export function currentTransport(): Transport {
  return state.transport;
}

function userAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0];
}

function headersFor(transport: Transport): Record<string, string> {
  const base = {
    'User-Agent': userAgent(),
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://explore.jobs.netflix.net/careers',
  };
  if (transport === 'direct') return base;
  // Ask the reader for the untransformed body instead of its markdown rendering.
  return { ...base, 'x-respond-with': 'text' };
}

// Depending on content negotiation the reader either passes the upstream body
// through verbatim or wraps it as {code, status, data: {text: "<body>"}}.
function unwrap(parsed: unknown): unknown {
  const envelope = parsed as { data?: { text?: unknown } } | null;
  const text = envelope?.data?.text;
  if (typeof text !== 'string') return parsed;
  return JSON.parse(text);
}

// The reader endpoint rate limits per IP, so serialise the gap between sends.
async function awaitReaderSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = state.readerNextAt - now;
  state.readerNextAt = Math.max(now, state.readerNextAt) + readerGate.spacingMs;
  if (waitMs > 0) await sleep(waitMs);
}

async function sendOnce(url: string, transport: Transport, timeoutMs: number): Promise<unknown> {
  const target = transport === 'direct' ? url : `${READER_PREFIX}${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      headers: headersFor(transport),
      signal: controller.signal,
      redirect: 'follow',
    });
    const body = await res.text();
    if (!res.ok) throw new HttpError(res.status, target);
    return unwrap(JSON.parse(body));
  } finally {
    clearTimeout(timer);
  }
}

function noteDirectResult(blocked: boolean): void {
  if (!blocked) {
    state.blockStreak = 0;
    return;
  }
  state.blockStreak += 1;
  if (state.blockStreak < BLOCK_STREAK_TO_DEMOTE) return;
  if (state.transport === 'reader') return;
  state.transport = 'reader';
  console.log('  transport: WAF-blocked on direct, switching to reader proxy');
}

// Every RETRY_DIRECT_AFTER reader calls, spend one request checking whether the
// WAF block has lifted; if it has, the rest of the run goes direct and fast.
function shouldProbeDirect(): boolean {
  if (state.transport === 'direct') return false;
  state.sinceDirectProbe += 1;
  if (state.sinceDirectProbe < RETRY_DIRECT_AFTER) return false;
  state.sinceDirectProbe = 0;
  return true;
}

export async function send(url: string, timeoutMs: number): Promise<unknown> {
  const probing = shouldProbeDirect();
  const transport: Transport = probing ? 'direct' : state.transport;

  const run = async (): Promise<unknown> => {
    const data = await sendOnce(url, transport, timeoutMs);
    state.counts[transport] += 1;
    return data;
  };

  try {
    const data = transport === 'reader'
      ? await readerGate.semaphore.run(async () => {
          await awaitReaderSlot();
          return run();
        })
      : await run();
    if (transport === 'direct') {
      noteDirectResult(false);
      if (probing) {
        state.transport = 'direct';
        console.log('  transport: direct is unblocked again, switching back');
      }
    }
    return data;
  } catch (err) {
    if (transport === 'direct') noteDirectResult(isBlocked(err));
    throw err;
  }
}
