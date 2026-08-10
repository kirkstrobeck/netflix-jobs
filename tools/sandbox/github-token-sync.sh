#!/usr/bin/env bash
set -euo pipefail

# HOST-SIDE. Runs on the Mac from boot.sh; never from inside the container.
#
# Bridges the host's GitHub token into the sandbox so inner can talk to GitHub
# over HTTPS. Writes a gh-shaped hosts.yml into tools/sandbox/.cache/gh, which
# docker-compose.yml mounts at /home/agent/.config/gh. Inside the container the
# `!gh auth git-credential` helper (wired up in entrypoint.sh) reads that file,
# so git pushes and API calls authenticate with no key material anywhere.
#
# Nothing under ~/.ssh is touched and no key is mounted. A token is revocable
# from the GitHub UI, is scoped, and expires; an SSH private key is none of
# those things.
#
# THE TOKEN IS NEVER PRINTED. Not to stdout, not to stderr, not into an error
# message, not into a log. It travels host env -> variable -> file descriptor
# and stops there. Do not add `set -x` to this file.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
GH_DIR="$SCRIPT_DIR/.cache/gh"
HOSTS_FILE="$GH_DIR/hosts.yml"

fail() {
  echo "github-token-sync: $1" >&2
  exit 1
}

# $GH_TOKEN wins so a caller can pin a specific token (CI, a scoped PAT)
# without touching the host's gh login. Otherwise ask gh for whatever the Mac
# is already authenticated with.
read_token() {
  if [ -n "${GH_TOKEN:-}" ]; then
    printf '%s' "$GH_TOKEN"
    return 0
  fi
  if ! command -v gh >/dev/null 2>&1; then
    return 0
  fi
  gh auth token 2>/dev/null || true
}

# hosts.yml is keyed by login, so the token alone isn't enough — we have to ask
# GitHub who it belongs to. This doubles as a liveness check: a revoked or
# expired token fails here instead of failing later as a confusing 403 on push.
resolve_login() {
  GH_TOKEN="$1" gh api user --jq .login 2>/dev/null || true
}

# Written mktemp -> chmod 600 -> mv. The rename is safe here (unlike
# .cache/claude.json, where a rename handed the host a new inode the running
# container could never see) because what compose mounts is the DIRECTORY
# .cache/gh, not this file. The directory inode is stable across the rename, so
# the container sees the new hosts.yml immediately. mktemp lands in the same
# directory to keep the mv atomic on one filesystem.
write_hosts() {
  local token="$1" login="$2" tmp
  mkdir -p "$GH_DIR"
  chmod 700 "$GH_DIR" 2>/dev/null || true

  tmp="$(mktemp "$GH_DIR/hosts.yml.XXXXXX")"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" EXIT
  chmod 600 "$tmp"

  {
    printf '%s\n' 'github.com:'
    printf '%s\n' '    git_protocol: https'
    printf '%s\n' '    users:'
    printf '        %s:\n' "$login"
    printf '            oauth_token: %s\n' "$token"
    printf '    user: %s\n' "$login"
    printf '    oauth_token: %s\n' "$token"
  } >"$tmp"

  mv -f "$tmp" "$HOSTS_FILE"
  trap - EXIT
}

token="$(read_token)"
if [ -z "$token" ]; then
  fail "no GitHub token available: set GH_TOKEN, or run 'gh auth login' on the host"
fi

if ! command -v gh >/dev/null 2>&1; then
  fail "gh CLI not found on the host; install it (brew install gh) so the login can be resolved"
fi

login="$(resolve_login "$token")"
if [ -z "$login" ]; then
  fail "'gh api user' failed; the token is invalid, expired, or the host is offline"
fi

write_hosts "$token" "$login"
echo "github-token-sync: wrote $HOSTS_FILE for $login" >&2
