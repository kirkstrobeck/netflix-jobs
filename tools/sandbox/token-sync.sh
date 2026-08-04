#!/usr/bin/env bash
set -euo pipefail

# Keeps the host's Claude OAuth credential and the sandbox's cached copy in
# sync, in both directions.
#
# Why this exists: Anthropic ROTATES the refresh token on every refresh. If
# inner refreshes and the new credential never makes it back to the host, the
# host's stored refresh token is already invalidated server-side and the user
# is forced to /login again. So: pull before dispatch, push after.
#
#   pull  Keychain / host file -> .cache/claude-home/.credentials.json
#   push  .cache/claude-home/.credentials.json -> host file + Keychain
#
# Both directions refuse to overwrite a NEWER credential with an older one,
# compared by `.claudeAiOauth.expiresAt`.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_CRED="$SCRIPT_DIR/.cache/claude-home/.credentials.json"
HOST_CRED="$HOME/.claude/.credentials.json"
KEYCHAIN_SERVICE="Claude Code-credentials"

expires_at() {
  local json="$1"
  printf '%s' "$json" | jq -r '.claudeAiOauth.expiresAt // 0' 2>/dev/null || echo 0
}

read_keychain() {
  security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true
}

read_file() {
  local path="$1"
  [ -f "$path" ] || return 0
  cat "$path" 2>/dev/null || true
}

valid_cred() {
  local json="$1"
  [ -n "$json" ] || return 1
  printf '%s' "$json" | jq -e '.claudeAiOauth.accessToken' >/dev/null 2>&1
}

# Picks whichever of the given credential blobs has the latest expiresAt.
newest() {
  local best="" best_exp=0 candidate exp
  for candidate in "$@"; do
    valid_cred "$candidate" || continue
    exp="$(expires_at "$candidate")"
    [ "$exp" -gt "$best_exp" ] || continue
    best="$candidate"
    best_exp="$exp"
  done
  printf '%s' "$best"
}

do_pull() {
  local from_keychain from_host chosen
  from_keychain="$(read_keychain)"
  from_host="$(read_file "$HOST_CRED")"
  chosen="$(newest "$from_keychain" "$from_host" "$(read_file "$CACHE_CRED")")"

  if ! valid_cred "$chosen"; then
    echo "token-sync: no valid host credential found; inner may need /login" >&2
    return 0
  fi

  mkdir -p "$(dirname "$CACHE_CRED")"
  printf '%s' "$chosen" >"$CACHE_CRED.tmp"
  mv -f "$CACHE_CRED.tmp" "$CACHE_CRED"
  chmod 600 "$CACHE_CRED"
}

do_push() {
  local from_cache cache_exp host_exp
  from_cache="$(read_file "$CACHE_CRED")"
  valid_cred "$from_cache" || return 0

  cache_exp="$(expires_at "$from_cache")"
  host_exp="$(expires_at "$(newest "$(read_keychain)" "$(read_file "$HOST_CRED")")")"

  # Host already has something at least as fresh — nothing to carry back.
  [ "$cache_exp" -gt "$host_exp" ] || return 0

  mkdir -p "$(dirname "$HOST_CRED")"
  printf '%s' "$from_cache" >"$HOST_CRED.tmp"
  mv -f "$HOST_CRED.tmp" "$HOST_CRED"
  chmod 600 "$HOST_CRED"

  security add-generic-password -U -s "$KEYCHAIN_SERVICE" -a "$USER" \
    -w "$from_cache" 2>/dev/null || true
  echo "token-sync: pushed refreshed credential back to host" >&2
}

case "${1:-pull}" in
  pull) do_pull ;;
  push) do_push ;;
  *) echo "usage: token-sync.sh [pull|push]" >&2; exit 2 ;;
esac
