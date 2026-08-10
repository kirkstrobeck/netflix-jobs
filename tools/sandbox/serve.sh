#!/usr/bin/env bash
set -uo pipefail

# The one long-lived local server, and the thing that puts it back.
#
# PORT 3000 IS NOT A PREFERENCE. tools/sandbox/docker-compose.yml publishes
# exactly `127.0.0.1:3000:3000`, so 3000 is the only port inside this container
# the Mac can reach. A server on any other port answers every curl from in here
# and is still invisible in the browser -- which is what "the local server is
# down" has meant every time it has been reported.
#
# -H 0.0.0.0 for the same reason: docker-proxy connects from outside the
# container's own loopback, so a server bound to 127.0.0.1 refuses it.

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

# The supervisor proper. Runs detached; every exit of the server is a restart,
# because an unsupervised `next start` leaves nothing behind when it dies and
# the next person to look finds a dead port and no reason.
supervise() {
  # A crashing node writes its whole heap to ./core. The repo lives on the
  # Mac's disk through a Colima mount and that disk has run to 99% full; a
  # single 4.3GB dump from a runaway CLI is how it got there. Never again.
  ulimit -c 0

  # Bound the heap so a leak dies as one process with a logged exit code
  # instead of pushing the shared, oversubscribed VM into the OOM killer.
  export NODE_OPTIONS="--max-old-space-size=2048"
  export NODE_ENV=production

  cd "$APP" || exit 1
  echo "$$" > "$PIDFILE"

  local attempt=0
  while true; do
    echo "[serve] $(date -Is) starting next start -H $BIND -p $PORT" >> "$LOG"
    ./node_modules/.bin/next start -H "$BIND" -p "$PORT" >> "$LOG" 2>&1
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
  for pid in $(pgrep -f "next-server|next start -H" 2>/dev/null); do
    case "$skip" in *" $pid "*) continue ;; esac
    kill -9 "$pid" 2>/dev/null
  done
  sleep 1
}

start() {
  alive && { echo "serve: already supervised (pid $(cat "$PIDFILE"))"; return 0; }

  test -f "$APP/.next/BUILD_ID" || {
    echo "serve: no build in apps/web/.next -- run pnpm --filter web build first" >&2
    return 1
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
