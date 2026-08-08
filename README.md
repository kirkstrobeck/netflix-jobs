# Netflix Jobs

A [Turborepo](https://turbo.build/repo) containing the `web` Next.js app and a
local Supabase mirror of the Netflix careers board.

## Getting Started

Install dependencies and start all development tasks:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Edit `apps/web/src/app/page.tsx` to update the web app.

## Jobs database

Every posting on <https://explore.jobs.netflix.net/careers> is mirrored into a
local Supabase stack by `packages/ingestor`. See its
[README](packages/ingestor/README.md) for the schema and the crawl's quirks.

```bash
pnpm db:start     # Supabase on ports 54721 (API) / 54722 (db) / 54723 (Studio)
pnpm ingest       # crawl the board into public.jobs
```

The port block is deliberately off the 54321–54324 default so the stack can run
alongside another project's.

## Cache revalidation

The web app caches the whole board under one tag and holds it for a week, on the
assumption that the crawl announces itself. It does that through
`POST /api/revalidate` (`apps/web/src/app/api/revalidate/route.ts`), which
requires a shared secret in an `x-revalidate-secret` header and answers 401
without it.

| Env var             | Where               | Purpose                                        |
| ------------------- | ------------------- | ---------------------------------------------- |
| `REVALIDATE_SECRET` | web app + ingestor  | Shared secret; same value on both sides         |
| `REVALIDATE_URL`    | ingestor            | Endpoint to post to; defaults to `http://127.0.0.1:3000/api/revalidate` |

Both sides fail closed and fail soft respectively: the endpoint rejects every
caller when `REVALIDATE_SECRET` is unset there, and **the ingestor skips the call
with a warning, rather than posting unauthenticated, when it is unset there.** A
crawl whose revalidation never lands still succeeds — the data is written — but
the site keeps serving the previous crawl until its cache expires. See the
[ingestor README](packages/ingestor/README.md#telling-the-web-app).

## Commands

- `pnpm dev` — start development tasks
- `pnpm build` — build all workspaces
- `pnpm lint` — lint all workspaces
- `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` — local Supabase
- `pnpm db:forward` — loopback port forwarder, only needed inside the sandbox container
- `pnpm ingest` — crawl the Netflix careers board into Supabase
