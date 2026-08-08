import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { JOBS_BOARD_TAG, jobTag } from "@/lib/jobs/cache-tags";

// The one door the ingestor knocks on. It runs as a separate process against the
// same Supabase, so nothing it writes can invalidate a Next cache entry on its
// own -- see the `jobs` profile in next.config.ts, whose time-based numbers are
// deliberately long because THIS is the mechanism and they are the backstop.
//
// POST only, and no GET twin: a GET would be reachable from a browser address
// bar and from anything that prefetches links, and its secret would sit in
// referrers and access logs.

const SECRET_HEADER = "x-revalidate-secret";

// revalidateTag's second argument is required as of Next 16 -- the one-argument
// form is deprecated and expires the entry immediately, making the next reader
// block on Supabase. "max" marks the tag stale instead: the next visitor is
// served the previous render while the fresh one is built behind them, and
// everyone after that gets the new crawl. The alternative the docs offer for
// webhooks, `{ expire: 0 }`, buys strict freshness at the cost of putting a
// Supabase round trip in front of the first visitor after every crawl. A jobs
// board that just changed by a handful of postings does not need that.
const PROFILE = "max";

type RevalidateBody = { jobIds?: unknown; board?: unknown };

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Hashing both sides before comparing is what makes this safe to call with
// attacker-controlled input: timingSafeEqual THROWS on a length mismatch, so
// handing it the raw strings would turn the secret's length into a 500 vs 401
// oracle. Two SHA-256 digests are always 32 bytes, so the compare is the only
// thing that varies, and it is constant-time.
function authorized(request: Request): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  const presented = request.headers.get(SECRET_HEADER);

  // Fail closed. An unset secret means nobody is authorized, not everybody --
  // the endpoint is a cache-flush lever for anyone who finds it.
  if (!expected || !presented) {
    return false;
  }

  return timingSafeEqual(digest(presented), digest(expected));
}

function jsonError(message: string, status: number): Response {
  return Response.json({ revalidated: false, error: message }, { status });
}

// An empty body is the common call -- "the crawl finished, flush the board" --
// so it is valid, not a parse error.
function parseBody(text: string): RevalidateBody | null {
  if (text.trim() === "") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as RevalidateBody;
  } catch {
    return null;
  }
}

// null means malformed, which is a 400. An absent jobIds is not malformed; it is
// the board-only call.
function readJobIds(body: RevalidateBody): string[] | null {
  if (body.jobIds === undefined) {
    return [];
  }

  if (!Array.isArray(body.jobIds)) {
    return null;
  }

  const ids = body.jobIds.filter(
    (id): id is string => typeof id === "string" && id.trim() !== "",
  );

  return ids.length === body.jobIds.length ? ids : null;
}

// Defaults to true, which is what makes `{ jobIds }` mean "those postings AND
// the listing they appear in" -- a retitled job changes the row on the home page
// too. `{ jobIds, board: false }` is the narrow form: flush those postings only.
function readBoard(body: RevalidateBody): boolean | null {
  if (body.board === undefined) {
    return true;
  }

  if (typeof body.board !== "boolean") {
    return null;
  }

  return body.board;
}

function tagsFor(jobIds: string[], board: boolean): string[] {
  const boardTags = board ? [JOBS_BOARD_TAG] : [];

  // Deduped because jobTag uppercases, so ["jr41912", "JR41912"] is one tag, and
  // revalidating it twice is a wasted call rather than a second invalidation.
  return [...new Set([...boardTags, ...jobIds.map(jobTag)])];
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return jsonError("unauthorized", 401);
  }

  const body = parseBody(await request.text());
  if (body === null) {
    return jsonError("body must be a JSON object", 400);
  }

  const jobIds = readJobIds(body);
  if (jobIds === null) {
    return jsonError("jobIds must be an array of non-empty strings", 400);
  }

  const board = readBoard(body);
  if (board === null) {
    return jsonError("board must be a boolean", 400);
  }

  const tags = tagsFor(jobIds, board);

  // `{ board: false }` with no ids asks for nothing. Answering 200 to it would
  // tell a caller its cache flush landed when it did not.
  if (tags.length === 0) {
    return jsonError("nothing to revalidate: board is false and jobIds is empty", 400);
  }

  for (const tag of tags) {
    revalidateTag(tag, PROFILE);
  }

  // Echo what was actually invalidated rather than what was asked for, so the
  // ingestor's log says which tags moved -- including the board tag it did not
  // name explicitly.
  return Response.json({ revalidated: true, board, jobIds, tags, profile: PROFILE });
}
