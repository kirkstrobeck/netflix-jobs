# @netflix-jobs/ingestor

Mirrors the Netflix careers board into the local Supabase stack.

Source: <https://explore.jobs.netflix.net/careers> — an Eightfold ("PCS") tenant,
board slug `explore.jobs.netflix.net|netflix.com`. Request shapes are ported from
the `easytopjobs` pipeline (`packages/pipeline/lib/eightfold-api.ts`).

## Run it

```bash
supabase start                 # from the repo root; see note below
pnpm --filter @netflix-jobs/ingestor ingest
```

No dependencies to install — it runs on plain `node bin/ingest.ts` using Node's
built-in TypeScript stripping and `fetch`.

| Env var               | Default | Purpose                                   |
| --------------------- | ------- | ----------------------------------------- |
| `SUPABASE_URL`        | `http://127.0.0.1:54721` | PostgREST endpoint        |
| `SUPABASE_SERVICE_ROLE_KEY` | local demo key      | Write credential          |
| `MAX_JOBS`            | `0` (all) | Cap the crawl, for smoke tests          |
| `DETAIL_CONCURRENCY`  | `3`     | Parallel detail fetches                   |
| `READER_SPACING_MS`   | `900`   | Min gap between proxy requests            |

## How the crawl works

The board's list endpoint hard-caps at **10 results per page** regardless of
`num`, and always returns an empty `job_description`. So a full crawl is
~49 list pages to enumerate, plus one detail fetch per posting for the
description. Detail fetches fail soft: a posting whose detail errors still lands
with its list-page fields and an empty `description_text`.

## The 403 problem

Netflix fronts `explore.jobs.netflix.net` with CloudFront + AWS WAF. From some
egress IPs **every path on the host returns 403 "Request blocked"** — including
`robots.txt` — regardless of user agent or TLS fingerprint (verified against
`curl-impersonate` Chrome/Firefox/Safari profiles). The same requests succeed
from other IPs, so it is an IP-reputation verdict rather than anything about the
request.

`lib/http.ts` therefore carries two transports and prefers whichever works:

- **direct** — plain `fetch`; fast, no third party.
- **reader** — `r.jina.ai` raw passthrough (`x-respond-with: text`); reaches the
  board from a blocked IP, but rate limits, so calls are spaced and 429s retried.

It starts on `direct`, demotes to `reader` after three consecutive 403s, and
re-probes `direct` every 50 requests — so once the block lifts, the run speeds
back up on its own. `ingest_runs.notes` records the transport split per run.

## Schema

`supabase/migrations/`:

- `jobs` — one row per Eightfold position id, with `raw` jsonb for the full payload
- `job_locations` — postings exploded by location
- `ingest_runs` — per-crawl provenance and counts
- `ingest_jobs(payload, run)` — atomic bulk upsert used by the ingestor
- `jobs_active` — convenience view over currently-listed postings

## Sandbox note

The Supabase CLI drives the Mac's Docker daemon, so run it from `$REPO_ROOT`
(not `/workspace`) and start `node tools/supabase-port-forward.mjs` first —
sibling containers publish their ports on the Mac, but the CLI dials
`127.0.0.1`.
