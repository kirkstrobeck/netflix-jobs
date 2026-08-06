# netflix-jobs sandbox

A containerized Claude that does the actual work on this repo, so nothing runs
directly against the Mac.

- **Outer Claude** (the one in your terminal) is a relay. It dispatches and
  reports. A PreToolUse hook (`outer-gate.sh`) enforces this mechanically.
- **Inner Claude** runs `--dangerously-skip-permissions` inside the container
  and does everything: installs, migrations, ingestion, commits.

## Use it

```bash
bash tools/sandbox/dispatch.sh "<what you want done>"     # new session
bash tools/sandbox/dispatch.sh --continue "<follow-up>"   # same session
bash tools/sandbox/tail.sh -f                             # watch progress
bash tools/sandbox/boot.sh                                # build/start only
bash tools/sandbox/bootstrap.sh                           # force image rebuild
```

## What the container gets

| Mount | Why |
|---|---|
| `$REPO_ROOT` → `/workspace` | the repo |
| `$REPO_ROOT` → `$REPO_ROOT` | same-path, so `supabase start` bind mounts resolve on the Colima VM |
| host `docker.sock` | inner drives the host daemon; Supabase containers are siblings |
| named `nm_*` volumes | container-private linux `node_modules` + `apps/web/.next`, shadowing the Mac bind mount |
| `.cache/claude-home` | writable copy of `~/.claude` — inner's token refresh is carried back by `token-sync.sh push` |
| `.cache/claude.json` (ro) | onboarding marker so `claude -p` starts non-interactively |

Git identity is mirrored from the host. `GIT_EDITOR`/`VISUAL`/`EDITOR` are
`/bin/false`, so a `git commit` without `-m`/`-F` fails instead of hanging.

## Runtime

Colima, not Docker Desktop. The socket is
`~/.colima/default/docker.sock`; `common.sh` sets `DOCKER_HOST` for every
script. If the daemon is down: `colima start`.

### Fast Refresh (host save → browser)

A Mac save crosses virtiofs as bytes but **not** as an inotify event, so
Turbopack's watcher sees a tree that never changes. One thing fixes that now:
`mac-save-bridge.mjs`, running in the container, polls `apps/web/src` every
250ms and rewrites a changed file in place so the native watcher gets a real
`MODIFY`. Measured: detect ~160ms, rebuild ~90ms.

Do NOT reintroduce the event-injection approach. Colima's `--mount-inotify`,
`inotify-amplify.sh` and `host-fs-bridge.mjs` all manufactured the missing event
by writing the file from the *other* side of the mount, and every such write
propagates back across it and retriggers whatever was watching. `host-fs-bridge`
fed itself: its `docker exec dd` landed on the macOS file, FSEvents fired, and it
rewrote again ~12×/second. Measured before removal: **34 inotify events in a 15s
window on a file nobody touched** — a permanent recompile storm, and the likeliest
author of `apps/web/.next.bak-oom`. `boot.sh` now stops all three on every boot.

The bridge cannot loop: it waits on no event, and it records the mtime its own
rewrite produces, so its write is not a change the next pass can see.

`watchOptions.pollIntervalMs` is deliberately unset. It is the documented knob
for this, but Turbopack polls from the monorepo root — 20,713 files vs the 71
under `src`, 2.5–12s per pass on virtiofs. Same edit, same file: native watcher
91ms, `pollIntervalMs: 400` **15,400ms**.

`apps/web/.next` lives on a named volume (not virtiofs) — Turbopack's cache is
large and churns, and it has no business crossing the mount.

## Files

| File | Role |
|---|---|
| `common.sh` | resolves `REPO_ROOT`, `SANDBOX_NAME`, `DOCKER_HOST` — sourced by the rest |
| `colima-inotify.sh` | Colima VM flags; stops the mount-inotify daemon |
| `dev-fs.sh` | named-volume ownership; stops the old watchers, starts the bridge |
| `mac-save-bridge.mjs` | guest: polls `src` mtimes → in-place rewrite → native `MODIFY` |
| `boot.sh` | idempotent build + start; prints the container name |
| `bootstrap.sh` | builds `netflix-jobs-sandbox:local` |
| `dispatch.sh` | runs `claude -p` inside; prints `.result` |
| `tail.sh` | renders inner's transcript as one-liners |
| `token-sync.sh` | two-way OAuth credential sync with the host Keychain |
| `outer-gate.sh` | PreToolUse allowlist that forces dispatch |
| `AGENT.md` | baked to inner's `~/.claude/CLAUDE.md` |

`.cache/` holds credentials and is gitignored. Never commit it.
