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

## Commands

- `pnpm dev` — start development tasks
- `pnpm build` — build all workspaces
- `pnpm lint` — lint all workspaces
- `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` — local Supabase
- `pnpm db:forward` — loopback port forwarder, only needed inside the sandbox container
- `pnpm ingest` — crawl the Netflix careers board into Supabase
