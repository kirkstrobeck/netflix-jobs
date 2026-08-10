#!/usr/bin/env bash
set -uo pipefail

# The one long-lived local server, and the thing that puts it back.
#
# IT RUNS `next dev`. THAT IS THE POINT OF IT.
#
# It used to run `next start` with NODE_ENV=production against a prebuilt
# .next, and that is a server that cannot be developed against: a production
# build bakes every module in at build time, so editing
# apps/web/src/lib/ultra/ultra-config.ts and reloading 127.0.0.1:3000 correctly
# showed nothing at all. The value on screen was whatever was true when someone
# last ran `pnpm --filter web build`. Every edit needed a rebuild nobody was
# told about, and the failure mode was silence.
#
# PORT 3000 IS NOT A PREFERENCE. tools/sandbox/docker-compose.yml publishes
# exactly `127.0.0.1:3000:3000`, so 3000 is the only port inside this container
# the Mac can reach. A server on any other port answers every curl from in here
# and is still invisible in the browser -- which is what "the local server is
# down" has meant every time it has been reported.
#
# -H 0.0.0.0 for the same reason: docker-proxy connects from outside the
# container's own loopback, so a server bound to 127.0.0.1 refuses it.
#
# WHAT MAKES AN EDIT ON THE MAC REACH THE WATCHER
#
# The repo is a virtiofs bind mount. The bytes of a Mac save cross it
# immediately; the inotify event does not, so Turbopack's native watcher sits on
# a tree that from its point of view never changes. That is solved, and not by
# `watchOptions.pollIntervalMs`: Turbopack polls from `turbopack.root`, the
# monorepo root, so a pass stats 20,713 files instead of the 71 under
# apps/web/src, and the same edit took 15,400ms against the native watcher's
# 91ms. See the comment where that setting would go in next.config.ts.
#
# The polling that does happen is tools/sandbox/mac-save-bridge.mjs: it polls
# src alone from inside the container and rewrites the changed file in place,
# which produces the guest inotify event virtiofs will not carry. boot.sh starts
# it from the outside; this script now makes sure it is up too, because a dev
# server whose watcher is deaf is the same silence as the production build was.

PORT=3000
BIND=0.0.0.0
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT/apps/web"
RUN="$ROOT/.sandbox-run"
LOG="$RUN/serve.log"
PIDFILE="$RUN/serve.pid"

mkdir -p "$RUN"

alive() {
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null)"
  test -n "$pid" || return 1
  kill -0 "$pid" 2>/dev/null
}

# The thing that turns a Mac save into a guest inotify event. Started here as
# well as from boot.sh, because this script is what people run when the local
# server is wrong, and "the watcher is deaf" looks exactly like "the server is
# stale". Idempotent: one bridge, whoever got there first.
ensure_bridge() {
  pgrep -f 'mac-save-bridge\.mjs' >/dev/null 2>&1 && return 0

  setsid nohup node "$ROOT/tools/sandbox/mac-save-bridge.mjs" "$APP/src" \
    < /dev/null >> "$LOG" 2>&1 &
  disown 2>/dev/null
  echo "[serve] $(date -Is) started mac-save-bridge" >> "$LOG"
}

# The supervisor proper. Runs detached; every exit of the server is a restart,
# because an unsupervised `next dev` leaves nothing behind when it dies and the
# next person to look finds a dead port and no reason.
supervise() {
  # A crashing node writes its whole heap to ./core. The repo lives on the
  # Mac's disk through a Colima mount and that disk has run to 99% full; a
  # single 4.3GB dump from a runaway CLI is how it got there. Never again.
  ulimit -c 0

  # Bound the heap so a leak dies as one process with a logged exit code
  # instead of pushing the shared, oversubscribed VM into the OOM killer.
  export NODE_OPTIONS="--max-old-space-size=2048"
  # NODE_ENV is NOT set. `next dev` sets it to development itself, and forcing
  # production is what made this a build-once server in the first place.

  cd "$APP" || exit 1
  echo "$$" > "$PIDFILE"

  local attempt=0
  while true; do
    ensure_bridge
    # The generated stylesheets are build artifacts that dev does not generate:
    # `pnpm dev` is `codegen:css && next dev`, so this is the same command with
    # the supervisor around it rather than a shortcut past it.
    pnpm codegen:css >> "$LOG" 2>&1
    echo "[serve] $(date -Is) starting next dev -H $BIND -p $PORT" >> "$LOG"
    ./node_modules/.bin/next dev -H "$BIND" -p "$PORT" >> "$LOG" 2>&1
    local code=$?
    attempt=$((attempt + 1))
    echo "[serve] $(date -Is) exited code=$code attempt=$attempt -- restarting" >> "$LOG"
    sleep 2
  done
}

# Every process between here and pid 1. A bare `pkill -f next-server` also
# matches the shell that typed the words -- that shell dies with 143 and the
# restart never happens -- so the caller's own line of descent is off limits.
ancestry() {
  local pid=$$
  while test "${pid:-0}" -gt 1; do
    echo "$pid"
    pid="$(awk '{print $4}' "/proc/$pid/stat" 2>/dev/null)"
  done
}

# Anything already holding 3000 is either this supervisor or a stale server from
# a previous session. Both have to go before a new one can bind.
clear_port() {
  local skip pid
  skip=" $(ancestry | tr '\n' ' ') "
  for pid in $(pgrep -f "next-server|next dev -H|next start -H" 2>/dev/null); do
    case "$skip" in *" $pid "*) continue ;; esac
    kill -9 "$pid" 2>/dev/null
  done
  sleep 1
}

start() {
  alive && { echo "serve: already supervised (pid $(cat "$PIDFILE"))"; return 0; }

  # No .next/BUILD_ID precondition any more: dev compiles on demand and there is
  # nothing to have built first. What IS worth clearing is a PRODUCTION build
  # left in .next -- dev and build share the directory, and dev served 404s for
  # every route on top of one. The directory itself is a busy mount point, so
  # its CONTENTS go and the directory stays.
  test -f "$APP/.next/BUILD_ID" && {
    echo "serve: clearing a production build out of .next" >&2
    find "$APP/.next" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
  }

  clear_port
  # setsid puts the supervisor in its own session, so `pkill -f 'claude -p'`
  # from a dispatch -- and the death of whatever shell started it -- cannot
  # reach it. That is the difference between a server and a restart.
  setsid nohup "${BASH_SOURCE[0]}" __supervise < /dev/null >> "$LOG" 2>&1 &
  disown 2>/dev/null
  sleep 1
  echo "serve: supervisor started, logging to $LOG"
}

stop() {
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null)"
  test -n "$pid" && kill "$pid" 2>/dev/null
  rm -f "$PIDFILE"
  clear_port
  echo "serve: stopped"
}

status() {
  alive && echo "serve: supervisor pid $(cat "$PIDFILE")"
  alive || echo "serve: no supervisor"
  curl -sS -o /dev/null -w "serve: %{http_code} %{url_effective}\n" \
    --max-time 10 "http://127.0.0.1:$PORT/" 2>&1
}

case "${1:-start}" in
  __supervise) supervise ;;
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *) echo "usage: serve.sh [start|stop|restart|status]" >&2; exit 2 ;;
esac
