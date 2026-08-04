# Sandbox agent rules

You are running inside the netflix-jobs sandbox container as the `agent` user,
with `--dangerously-skip-permissions`. The container is the trust boundary —
you do the work directly.

## You ARE the sandbox

Never run `tools/sandbox/dispatch.sh`, `boot.sh`, `bootstrap.sh`, or `tail.sh`
from in here. Those are the OUTER agent's tools for reaching you; running them
from inside recurses into another container. If you catch yourself reaching for
one, you meant to just do the work.

## Communication

Your final message is relayed verbatim to a human who cannot see your tool
calls, your files, or your reasoning. Write it for that reader:

- State what you actually did and what you verified, with evidence (row counts,
  command output, file paths).
- If you're blocked, say precisely what's blocking you.
- When you need a decision, ask exactly ONE yes/no question as plain text and
  stop. No multiple-choice menus, no numbered option lists.

## How to work

- Work autonomously. Read the repo's `AGENTS.md` and `CLAUDE.md` first; they
  override defaults.
- Commit often, in logical units. Commit NON-INTERACTIVELY — always `-m` or
  `-F <file>`. There is no editor; `core.editor` is `/bin/false` and a bare
  `git commit` will fail.
- Prefer real verification over assertion. Run the thing. Query the database.
  Show the count.
- Files stay under 200 lines. Never use `else` or `elseif`.

## When you get stuck

After 2 failed attempts at the same problem, STOP hacking. Build a fishbone
across these six categories, then verify the top 3 hypotheses before writing
more code:

- **Environment** — container vs. host paths, UID/GID, mounts, DNS, ports
- **Data** — shape, encoding, nulls, pagination, upstream caps
- **Code** — the logic you just wrote
- **Tooling** — CLI versions, API version skew, package manager
- **Process** — order of operations, missing migration, stale state
- **External** — upstream rate limits, 403s, network

## Ask before

- Signing up for a service or creating an account
- Generating or rotating a secret
- Spending money
- Irreversible destructive actions (dropping data outside the local stack,
  force-pushing, deleting host files)
- An architectural pivot away from what was asked

Everything else: proceed.

## Environment specifics

- `/workspace` is the repo. It is ALSO mounted at its real host path
  (`$REPO_ROOT`) — identical content, two paths.
- **Run `supabase` commands from `$REPO_ROOT`, not `/workspace`.** The Supabase
  CLI talks to the host Docker daemon through the mounted socket, and the daemon
  bind-mounts paths from *its* filesystem. Only the host path resolves there.
- `node_modules` directories are container-private volumes (linux-arm64). Run
  your own `pnpm install`; it will not touch the Mac's install.
- The host is reachable at `host.docker.internal`.
- `docker` here is the HOST daemon. Containers you start are siblings, not
  children, and their published ports land on the Mac.
