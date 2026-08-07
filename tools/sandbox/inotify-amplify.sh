#!/usr/bin/env bash
# Amplify Colima mount-inotify ATTRIB events into content MODIFY events.
#
# Colima injects host saves by chmod'ing the guest file (ATTRIB only). Cursor
# also saves via temp+rename, which changes the inode Turbopack was watching.
# Rewriting the file contents in-place fires MODIFY on the live path so Next
# invalidates. Not polling — it only runs when inotify delivers an event.
#
# Runs inside the sandbox container. Started by boot.sh.

set -euo pipefail

ROOT="${1:-/workspace/apps/web/src}"
MARKER="/tmp/inotify-amplify.last"

command -v inotifywait >/dev/null

amplify() {
  local file="$1"
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.css|*.json) ;;
    *) return 0 ;;
  esac
  [ -f "$file" ] || return 0

  # Skip echoes of our own rewrite (ATTRIB+MODIFY within 250ms).
  local now last=0
  now="$(date +%s%3N)"
  if [ -f "$MARKER" ]; then
    last="$(cat "$MARKER" 2>/dev/null || echo 0)"
  fi
  if [ "$((now - last))" -lt 250 ]; then
    return 0
  fi

  # Rewrite in place without truncating to empty first (avoids Next 500s).
  dd if="$file" of="$file" conv=notrunc status=none
  printf '%s' "$now" >"$MARKER"
}

mkdir -p "$ROOT"
echo "inotify-amplify watching $ROOT" >&2

inotifywait -m -r \
  -e attrib,create,moved_to,modify \
  --format '%e|%w%f' \
  "$ROOT" |
  while IFS='|' read -r events file; do
    case "$events" in
      *ATTRIB*|*CREATE*|*MOVED_TO*) amplify "$file" ;;
    esac
  done
