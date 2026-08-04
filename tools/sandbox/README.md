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
| named `nm_*` volumes | container-private linux `node_modules`, shadowing the Mac's darwin install |
| `.cache/claude-home` | writable copy of `~/.claude` — inner's token refresh is carried back by `token-sync.sh push` |
| `.cache/claude.json` (ro) | onboarding marker so `claude -p` starts non-interactively |

Git identity is mirrored from the host. `GIT_EDITOR`/`VISUAL`/`EDITOR` are
`/bin/false`, so a `git commit` without `-m`/`-F` fails instead of hanging.

## Runtime

Colima, not Docker Desktop. The socket is
`~/.colima/default/docker.sock`; `common.sh` sets `DOCKER_HOST` for every
script. If the daemon is down: `colima start`.

## Files

| File | Role |
|---|---|
| `common.sh` | resolves `REPO_ROOT`, `SANDBOX_NAME`, `DOCKER_HOST` — sourced by the rest |
| `boot.sh` | idempotent build + start; prints the container name |
| `bootstrap.sh` | builds `netflix-jobs-sandbox:local` |
| `dispatch.sh` | runs `claude -p` inside; prints `.result` |
| `tail.sh` | renders inner's transcript as one-liners |
| `token-sync.sh` | two-way OAuth credential sync with the host Keychain |
| `outer-gate.sh` | PreToolUse allowlist that forces dispatch |
| `AGENT.md` | baked to inner's `~/.claude/CLAUDE.md` |

`.cache/` holds credentials and is gitignored. Never commit it.
