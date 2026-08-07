#!/usr/bin/env bash
set -uo pipefail

# PreToolUse hook on Edit/Write/MultiEdit/NotebookEdit. The counterpart to
# outer-gate.sh: that one stops the outer agent from RUNNING host commands, this
# one stops it from EDITING host files directly.
#
# Without it the block is only half a block. Outer was denied every shell path
# into the repo and then reached for the Edit tool, which no hook covered, and
# hand-edited a source file on the Mac. Only a human noticing and rejecting the
# call stopped it. That has to be mechanical.
#
# The exception is the sandbox harness itself -- .claude/ and tools/sandbox/ are
# outer's own wiring, and outer has to be able to repair the thing that dispatches
# to inner without dispatching to inner to do it.
#
# And outer's own state outside the repo: the auto-memory directory under
# ~/.claude and the session scratchpad. The rule this gate enforces is that the
# Mac's checkout and the container's checkout stay one tree; those files are in
# no checkout at all, so denying them protects nothing and costs outer the two
# things it is supposed to do on the host -- remember, and keep scratch notes.
#
# Reads the hook payload on stdin, writes a permission decision on stdout.
# Fails OPEN on any internal error -- a broken gate must not brick the session.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# No lib, no decision. Emitting nothing falls through to the normal permission
# flow, which is the fail-open behaviour we want from a broken gate.
if [ ! -r "$SCRIPT_DIR/gate-lib.sh" ]; then
  exit 0
fi
# shellcheck source=gate-lib.sh
. "$SCRIPT_DIR/gate-lib.sh"

gate_bypass_if_inner

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$SCRIPT_DIR/../..}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" 2>/dev/null && pwd -P)" || exit 0
[ -n "$PROJECT_ROOT" ] || exit 0

# Collapse . and .. lexically, before touching the filesystem. Order matters:
# resolving first and normalizing after lets `nonexistent/../../etc` keep a live
# .. in the tail, and a prefix check on a path containing .. proves nothing.
gate_normalize() {
  local p="$1" out="" comp had_f=0
  case "$-" in *f*) had_f=1 ;; esac
  set -f
  local IFS=/
  # shellcheck disable=SC2086  # deliberate split on IFS=/, globbing off
  set -- $p
  for comp in "$@"; do
    case "$comp" in
      ''|.) ;;
      ..) out="${out%/*}" ;;
      *) out="$out/$comp" ;;
    esac
  done
  [ "$had_f" = 1 ] || set +f
  printf '%s' "${out:-/}"
}

# Physical path for a file that may not exist yet (Write creates new files, so
# realpath -e is useless here and macOS realpath has no -m). Walk up to the
# deepest directory that does exist, pwd -P that -- which is what collapses a
# symlinked ancestor -- then re-attach the tail. Symlinks on the leaf itself get
# followed after, bounded, so `.claude/x -> /etc/x` cannot smuggle a write out.
gate_resolve() {
  local p="$1" base="$2" rest="" dir parent real full hops=0 target
  case "$p" in
    /*) ;;
    *) p="$base/$p" ;;
  esac
  p="$(gate_normalize "$p")"

  dir="$p"
  while [ ! -d "$dir" ] && [ "$dir" != "/" ] && [ -n "$dir" ]; do
    rest="${dir##*/}${rest:+/$rest}"
    parent="${dir%/*}"
    [ -n "$parent" ] || parent="/"
    dir="$parent"
  done
  real="$(cd "$dir" 2>/dev/null && pwd -P)" || return 1
  [ -n "$real" ] || return 1
  full="${real%/}${rest:+/$rest}"

  while [ -L "$full" ] && [ "$hops" -lt 8 ]; do
    target="$(readlink "$full" 2>/dev/null)" || break
    [ -n "$target" ] || break
    case "$target" in
      /*) ;;
      *) target="${full%/*}/$target" ;;
    esac
    full="$(gate_normalize "$target")"
    hops=$((hops + 1))
  done

  printf '%s' "$full"
}

# Outer's own state, judged on the resolved path so the same traversal and
# symlink handling that guards the repo guards these too. The literal
# /nonexistent defaults matter: an unset HOME must not collapse the pattern to
# "/.claude/"* and start matching things.
gate_is_outer_state() {
  case "$1/" in
    "${HOME:-/nonexistent}/.claude/"*) return 0 ;;
    /private/tmp/claude-*/*|/tmp/claude-*/*) return 0 ;;
  esac
  return 1
}

payload="$(cat)"
tool="$(printf '%s' "$payload" | jq -r '.tool_name // ""' 2>/dev/null)"

case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) allow "not a file-writing call" ;;
esac

# The base for a relative path is the session cwd when the payload carries one.
cwd="$(printf '%s' "$payload" | jq -r '.cwd // ""' 2>/dev/null)"
[ -n "$cwd" ] || cwd="$PROJECT_ROOT"

# Every shape these tools use: file_path (Edit/Write/MultiEdit), notebook_path
# (NotebookEdit), and a per-edit file_path in case an edits array ever carries
# its own target. Collected together so a call that touches two files is judged
# on both, not on whichever key was read first.
paths="$(printf '%s' "$payload" | jq -r '
  [ .tool_input.file_path?,
    .tool_input.notebook_path?,
    (.tool_input.edits? // [] | .[]? | .file_path?) ]
  | map(select(type == "string" and length > 0)) | .[]' 2>/dev/null)"

# A write tool whose target we could not read is not an internal error, it is a
# write we cannot vouch for. Denying costs outer one dispatch; allowing reopens
# the exact hole this file exists to close.
if [ -z "$paths" ]; then
  deny "Could not read a file path from this $tool call, so it cannot be checked against the sandbox boundary. $DISPATCH_MSG"
fi

HARNESS_MSG="Only the sandbox harness (.claude/ and tools/sandbox/) is outer's to edit directly. Everything else in the repo is edited inside the container, so the Mac's tree and the container's stay one tree."

while IFS= read -r raw; do
  [ -n "$raw" ] || continue
  resolved="$(gate_resolve "$raw" "$cwd")" || exit 0
  [ -n "$resolved" ] || exit 0

  # Checked before the project-root test, which would otherwise deny these for
  # being outside a boundary they were never inside.
  if gate_is_outer_state "$resolved"; then
    continue
  fi

  case "$resolved/" in
    "$PROJECT_ROOT/"*) ;;
    *) deny "$raw resolves to $resolved, outside the project root. $HARNESS_MSG $DISPATCH_MSG" ;;
  esac

  case "$resolved/" in
    "$PROJECT_ROOT/.claude/"*|"$PROJECT_ROOT/tools/sandbox/"*) ;;
    *) deny "$resolved is project source, not sandbox harness. $HARNESS_MSG $DISPATCH_MSG" ;;
  esac
done <<EOF
$paths
EOF

allow "sandbox harness file (outer owns .claude/ and tools/sandbox/)"
