#!/usr/bin/env bash
# Shared identity + daemon resolution for the sandbox scripts. Source, don't run.
#
# Every script here must agree on REPO_ROOT and SANDBOX_NAME, or they'll talk to
# different containers. This file is the single place that decides both.

SANDBOX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# -P resolves symlinks. The path is handed to the host Docker daemon for bind
# mounts, and the daemon only knows physical paths.
REPO_ROOT="$(cd "$SANDBOX_DIR/../.." && pwd -P)"
SANDBOX_NAME="netflix-jobs-sandbox-$(printf '%s' "$REPO_ROOT" | shasum | cut -c1-8)"
CACHE_DIR="$SANDBOX_DIR/.cache"

# Sibling repo mounted read-only at /reference/easytopjobs when present — the
# source of the ATS client and jobs schema this project reuses. Optional: boot.sh
# skips the overlay entirely if the path doesn't exist.
REFERENCE_ROOT="${REFERENCE_ROOT:-$(dirname "$REPO_ROOT")/easytopjobs}"

export SANDBOX_DIR REPO_ROOT SANDBOX_NAME CACHE_DIR REFERENCE_ROOT

# Colima, not Docker Desktop. Its socket lives under ~/.colima, and nothing
# creates /var/run/docker.sock, so DOCKER_HOST must be set explicitly.
sandbox_docker_host() {
  local sock="$HOME/.colima/default/docker.sock"
  if [ -S "$sock" ]; then
    export DOCKER_HOST="unix://$sock"
  fi
}

sandbox_require_docker() {
  sandbox_docker_host
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  echo "Docker daemon not reachable. Start it with: colima start" >&2
  return 1
}
