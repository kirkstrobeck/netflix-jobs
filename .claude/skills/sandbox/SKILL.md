---
name: sandbox
description: How to do work in this repo — dispatch everything to the containerized inner Claude instead of running it on the Mac. Use whenever a task involves installing, building, migrating, running Supabase, ingesting data, or committing.
---

# Sandbox protocol

**Cardinal rule: outer Claude NEVER does the work.**

You are a relay. Inner Claude — running `--dangerously-skip-permissions` in a
container with the repo mounted — does the installing, the migrating, the
ingesting, the committing. You dispatch, you watch, you report.

A PreToolUse hook (`tools/sandbox/outer-gate.sh`) denies host commands
mechanically. If a Bash call comes back denied, that is the system telling you
to dispatch, not a puzzle to route around.

## Dispatching

First message of a task — pass the user's request **verbatim**:

```bash
bash tools/sandbox/dispatch.sh "<the user's message, verbatim>"
```

Every follow-up in the same task:

```bash
bash tools/sandbox/dispatch.sh --continue "<message>"
```

`dispatch.sh` prints inner's reply on stdout. **Surface it verbatim.** Do not
summarize it, do not pipe it through `jq`, do not rewrite it in your own voice.
The user is talking to inner through you.

## UI / prototype iterations — keep them instant

For visual / CSS / scratch-route tweaks:

- Dispatch the ask and relay the reply. That is the whole turn.
- Do **not** open a browser (`open http://…`), curl the page, screenshot,
  re-fetch HTML, or "confirm" the change yourself.
- Do **not** add extra verification instructions that undo the speed rules in
  `tools/sandbox/AGENT.md` unless the user asked to verify.
- Do **not** narrate progress for a one-file edit. Wait for inner, relay.

## Long turns

Real work (ingest, migrate, install) takes minutes. When a dispatch will run
long, launch it with `run_in_background: true` and report progress as it goes.

While waiting:

```bash
bash tools/sandbox/tail.sh -n 30    # recent activity
bash tools/sandbox/tail.sh -f       # follow
```

Status ticks carry a full wall clock and elapsed time, e.g.
`[2026-08-03 21:33:44 PDT | +12m4s] inner is fetching detail pages (312/481)`.

Never hand a rate limit or a session limit back to the user as a failure —
wait it out and continue.

## What outer MAY run

- `bash tools/sandbox/{dispatch,boot,bootstrap,tail}.sh …`
- `jq`, `pwd`, `echo`, `lsof`, `kill <pid>`, `colima …`
- `cat`/`ls` against `.claude/` and `tools/sandbox/`
- `docker ps|inspect|logs|info` and lifecycle on the **sandbox container only**
- `supabase stop` / `supabase status` — teardown and inspection only

Do **not** use `open` to launch browsers for UI iteration checks.

Everything else — `git`, `gh`, `pnpm`, `node`, `next`, `turbo`, `psql`,
`supabase start`, `supabase db …` — goes to inner.

## When something breaks

- **Daemon unreachable** → `colima start`, then re-dispatch. The runtime is
  Colima; there is no Docker Desktop on this Mac.
- **Container drifted** → `bash tools/sandbox/boot.sh` recreates it.
- **Inner says it needs `/login`** → the host credential expired; tell the user
  to run `claude` on the host once, then re-dispatch.
- **Image needs rebuilding** → `bash tools/sandbox/bootstrap.sh`.

## Inner asks a question

Inner is instructed to ask exactly one yes/no question at a time as plain text.
Relay it verbatim, get the user's answer, and pass it back with `--continue`.
