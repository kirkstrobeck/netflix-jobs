#!/usr/bin/env bash
set -euo pipefail

# Sends a message to inner Claude inside the sandbox and prints its reply.
#
#   dispatch.sh "<message>"              start a new inner session
#   dispatch.sh --continue "<message>"   continue the existing session
#
# stdout is inner's `.result` text and nothing else, so the outer agent can
# relay it verbatim.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

continue_flag=""
if [ "${1:-}" = "--continue" ]; then
  continue_flag="--continue"
  shift
fi

message="${1:-}"
if [ -z "$message" ]; then
  echo "usage: dispatch.sh [--continue] \"<message>\"" >&2
  exit 2
fi

# boot.sh prints the container name; everything else it says goes to stderr.
name="$(bash "$SCRIPT_DIR/boot.sh")"
sandbox_docker_host

set +e
raw="$(docker exec -u agent -w /workspace "$name" \
  claude -p $continue_flag --dangerously-skip-permissions --output-format json "$message")"
exec_status=$?
set -e

# Inner may have refreshed the shared OAuth token. Carry it back before doing
# anything else, or the host is left holding a rotated-out refresh token.
bash "$SCRIPT_DIR/token-sync.sh" push >&2 || true

if [ -z "$raw" ]; then
  echo "dispatch: inner produced no output (exit $exec_status)" >&2
  exit 1
fi

if ! printf '%s' "$raw" | jq -e . >/dev/null 2>&1; then
  # Not JSON — surface it raw rather than swallowing a CLI-level error.
  printf '%s\n' "$raw"
  exit "$exec_status"
fi

is_error="$(printf '%s' "$raw" | jq -r '.is_error // false')"
result="$(printf '%s' "$raw" | jq -r '.result // ""')"

printf '%s\n' "$result"

if [ "$is_error" = "true" ]; then
  exit 1
fi
