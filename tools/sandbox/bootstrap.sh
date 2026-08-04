#!/usr/bin/env bash
set -euo pipefail

# Builds the sandbox image. Called by boot.sh when no image exists or the
# baked-in agent stack has drifted. Safe to run directly.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HOST_UID="$(id -u)"
HOST_GID="$(id -g)"

ensure_docker_socket() {
  local sock="$HOME/.colima/default/docker.sock"
  if [ -S "$sock" ]; then
    export DOCKER_HOST="unix://$sock"
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon not reachable. Start it with: colima start" >&2
    exit 1
  fi
}

# Inner authenticates with a copy of the host's OAuth credential. If the host's
# is already expired, inner starts life logged out; better to say so here than
# to have inner fail cryptically on its first turn.
check_credential() {
  local cred
  cred="$(bash "$SCRIPT_DIR/token-sync.sh" pull >/dev/null 2>&1; cat "$SCRIPT_DIR/.cache/claude-home/.credentials.json" 2>/dev/null || true)"
  if [ -z "$cred" ]; then
    echo "WARNING: no Claude credential found on host; inner will need /login." >&2
    return 0
  fi
  local exp now
  exp="$(printf '%s' "$cred" | jq -r '.claudeAiOauth.expiresAt // 0')"
  now="$(node -e 'process.stdout.write(String(Date.now()))' 2>/dev/null || echo 0)"
  if [ "$exp" -le "$now" ]; then
    echo "WARNING: host Claude credential is expired; run 'claude' on the host to refresh." >&2
  fi
}

# Claude refuses to start non-interactively without a completed onboarding
# marker. The container gets its own minimal one.
ensure_claude_json() {
  local path="$SCRIPT_DIR/.cache/claude.json"
  mkdir -p "$SCRIPT_DIR/.cache"
  if [ ! -f "$path" ]; then
    printf '%s\n' '{"hasCompletedOnboarding": true}' >"$path"
  fi
}

ensure_docker_socket
ensure_claude_json
check_credential

echo "Building netflix-jobs-sandbox:local (this takes a few minutes on first run)..." >&2
docker build \
  --build-arg "HOST_UID=$HOST_UID" \
  --build-arg "HOST_GID=$HOST_GID" \
  -t netflix-jobs-sandbox:local \
  "$SCRIPT_DIR" >&2

echo "Built netflix-jobs-sandbox:local" >&2
