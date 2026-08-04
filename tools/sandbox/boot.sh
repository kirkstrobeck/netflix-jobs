#!/usr/bin/env bash
set -euo pipefail

# Brings the sandbox container up and prints its name on stdout. Idempotent:
# safe to call before every dispatch. All human-facing output goes to stderr so
# callers can capture the name with $(...).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

AGENT_STACK="claude-v1"
STACK_LABEL="com.netflix-jobs.sandbox.agent-stack"

ensure_colima() {
  if ! command -v colima >/dev/null 2>&1; then
    return 0
  fi
  if colima status >/dev/null 2>&1; then
    return 0
  fi
  echo "Starting Colima..." >&2
  colima start >&2
}

# Rebuild when the image is missing or was built from a different agent stack.
ensure_image() {
  local stack
  stack="$(docker image inspect netflix-jobs-sandbox:local \
    --format "{{ index .Config.Labels \"$STACK_LABEL\" }}" 2>/dev/null || true)"
  if [ "$stack" = "$AGENT_STACK" ]; then
    return 0
  fi
  bash "$SCRIPT_DIR/bootstrap.sh"
}

prepare_cache() {
  mkdir -p "$CACHE_DIR/claude-home"
  if [ ! -f "$CACHE_DIR/claude.json" ]; then
    printf '%s\n' '{"hasCompletedOnboarding": true}' >"$CACHE_DIR/claude.json"
  fi
  # Refresh the container's copy of ~/.claude.json from the host's live file.
  # The host rewrites it constantly, so a naive copy can catch a torn write;
  # retry until jq validates, and keep the last good copy if it never does.
  refresh_claude_json
  bash "$SCRIPT_DIR/token-sync.sh" pull >&2 || true
}

refresh_claude_json() {
  local src="$HOME/.claude.json" attempt=0
  [ -f "$src" ] || return 0
  while [ "$attempt" -lt 6 ]; do
    if jq -e . "$src" >"$CACHE_DIR/claude.json.tmp" 2>/dev/null; then
      mv -f "$CACHE_DIR/claude.json.tmp" "$CACHE_DIR/claude.json"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.2
  done
  rm -f "$CACHE_DIR/claude.json.tmp"
}

container_state() {
  docker inspect -f '{{.State.Status}}' "$SANDBOX_NAME" 2>/dev/null || true
}

# A container created against an older image or an older mount set must be
# recreated, not merely restarted — compose won't notice on its own.
container_is_current() {
  local image mounts
  image="$(docker inspect -f '{{.Image}}' "$SANDBOX_NAME" 2>/dev/null || true)"
  [ -n "$image" ] || return 1
  local want
  want="$(docker image inspect -f '{{.Id}}' netflix-jobs-sandbox:local 2>/dev/null || true)"
  [ "$image" = "$want" ] || return 1

  mounts="$(docker inspect -f '{{range .Mounts}}{{.Destination}} {{end}}' "$SANDBOX_NAME" 2>/dev/null || true)"
  case "$mounts" in
    *"$REPO_ROOT"*) ;;
    *) return 1 ;;
  esac
  case "$mounts" in
    *"/var/run/docker.sock"*) ;;
    *) return 1 ;;
  esac

  if [ ! -d "$REFERENCE_ROOT" ]; then
    return 0
  fi
  case "$mounts" in
    *"/reference/easytopjobs"*) return 0 ;;
    *) return 1 ;;
  esac
}

compose_files() {
  printf '%s\n' "-f" "$SCRIPT_DIR/docker-compose.yml"
  if [ -d "$REFERENCE_ROOT" ]; then
    printf '%s\n' "-f" "$SCRIPT_DIR/docker-compose.reference.yml"
  fi
}

compose_up() {
  local files=()
  while IFS= read -r line; do files+=("$line"); done < <(compose_files)

  HOST_UID="$(id -u)" \
  HOST_GID="$(id -g)" \
  HOST_GIT_NAME="$(git config --get user.name 2>/dev/null || echo '')" \
  HOST_GIT_EMAIL="$(git config --get user.email 2>/dev/null || echo '')" \
  REPO_ROOT="$REPO_ROOT" \
  REFERENCE_ROOT="$REFERENCE_ROOT" \
  SANDBOX_NAME="$SANDBOX_NAME" \
  docker compose "${files[@]}" -p "$SANDBOX_NAME" up -d >&2
}

ensure_container() {
  local state
  state="$(container_state)"

  if [ -n "$state" ] && ! container_is_current; then
    echo "Sandbox drifted from image/mount spec; recreating..." >&2
    docker rm -f "$SANDBOX_NAME" >/dev/null 2>&1 || true
    state=""
  fi

  if [ "$state" = "running" ]; then
    return 0
  fi

  compose_up
}

# The node_modules volumes are created root-owned on first use; inner runs as
# the host UID and could not write into them. Derived from the container's own
# mount table rather than a hardcoded list, so adding a workspace package to
# docker-compose.yml is the only edit that change ever needs.
node_modules_mounts() {
  docker inspect -f '{{range .Mounts}}{{.Destination}}
{{end}}' "$SANDBOX_NAME" 2>/dev/null | grep '/node_modules$' || true
}

fix_volume_ownership() {
  local targets=()
  while IFS= read -r dest; do
    [ -n "$dest" ] && targets+=("$dest")
  done < <(node_modules_mounts)
  [ "${#targets[@]}" -gt 0 ] || return 0

  docker exec -u 0 "$SANDBOX_NAME" sh -c \
    "mkdir -p $(printf '%q ' "${targets[@]}") 2>/dev/null; chown $(id -u):$(id -g) $(printf '%q ' "${targets[@]}") 2>/dev/null || true" \
    >/dev/null 2>&1 || true
}

ensure_colima
sandbox_require_docker
ensure_image
prepare_cache
ensure_container
fix_volume_ownership

printf '%s\n' "$SANDBOX_NAME"
