#!/usr/bin/env bash
set -euo pipefail

# Sends a message to inner Claude inside the sandbox and prints its reply.
#
#   dispatch.sh "<message>"              start a new inner session
#   dispatch.sh --continue "<message>"   continue the existing session
#   dispatch.sh --result                 print the last run's reply
#
# stdout is inner's `.result` text and nothing else, so the outer agent can
# relay it verbatim.
#
# Two things this guards against, both learned the hard way:
#
#   1. Killing the `docker exec` client does NOT kill the process inside the
#      container. When the caller's timeout fires, inner keeps running and keeps
#      writing files, so a "failed" dispatch is an orphan, not a dead run. Three
#      of them ended up editing the same files at once. Every run now kills any
#      inner still running before starting another -- one inner, always.
#
#   2. `claude -p` only emits its JSON at the very end, so a cut client loses
#      the entire result even though the work landed. Output is written to a
#      file INSIDE the container first and only then relayed, so `--result`
#      can recover it after a cut.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

RUN_DIR=/tmp/sandbox-dispatch

name="$(bash "$SCRIPT_DIR/boot.sh")"
sandbox_docker_host

# Prints whatever the last completed run left behind. Also the recovery path
# after a cut client: the file is written in the container, so it outlives us.
emit_stored_result() {
  local raw
  raw="$(docker exec "$name" cat "$RUN_DIR/last.json" 2>/dev/null || true)"

  if [ -z "$raw" ]; then
    echo "dispatch: no stored result" >&2
    return 1
  fi

  if ! printf '%s' "$raw" | jq -e . >/dev/null 2>&1; then
    # Not JSON -- surface it raw rather than swallowing a CLI-level error.
    printf '%s\n' "$raw"
    return 1
  fi

  printf '%s\n' "$(printf '%s' "$raw" | jq -r '.result // ""')"
  [ "$(printf '%s' "$raw" | jq -r '.is_error // false')" != "true" ]
}

if [ "${1:-}" = "--result" ]; then
  emit_stored_result
  exit $?
fi

continue_flag=""
if [ "${1:-}" = "--continue" ]; then
  continue_flag="--continue"
  shift
fi

message="${1:-}"
if [ -z "$message" ]; then
  echo "usage: dispatch.sh [--continue] \"<message>\" | --result" >&2
  exit 2
fi

# One inner at a time. An orphan from a cut client is still holding the working
# tree, and two agents editing the same files is worse than losing a run.
if docker exec "$name" pgrep -f 'claude -p' >/dev/null 2>&1; then
  echo "dispatch: killing inner still running from a previous dispatch" >&2
  docker exec "$name" pkill -f 'claude -p' >/dev/null 2>&1 || true
fi

# Created by root (exec's default user) but written by agent, so it has to be
# group/other writable or the redirect below fails with EACCES.
docker exec "$name" sh -c "mkdir -p $RUN_DIR && chmod 777 $RUN_DIR" >/dev/null
docker exec "$name" rm -f "$RUN_DIR/last.json" >/dev/null 2>&1 || true

# The message goes in through stdin rather than argv so no quoting of the
# prompt survives into a shell -- inner reads it back from the file.
printf '%s' "$message" | docker exec -i "$name" tee "$RUN_DIR/msg" >/dev/null

set +e
docker exec -u agent -w /workspace "$name" sh -c \
  "claude -p $continue_flag --dangerously-skip-permissions --output-format json \
     \"\$(cat $RUN_DIR/msg)\" > $RUN_DIR/last.json"
exec_status=$?
set -e

# Inner may have refreshed the shared OAuth token. Carry it back before doing
# anything else, or the host is left holding a rotated-out refresh token.
bash "$SCRIPT_DIR/token-sync.sh" push >&2 || true

if ! emit_stored_result; then
  echo "dispatch: inner produced no usable output (exit $exec_status)" >&2
  echo "dispatch: if this was a timeout, inner has been killed; check git status" >&2
  exit 1
fi
