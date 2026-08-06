#!/usr/bin/env bash
set -uo pipefail

# Feeds hook payloads to outer-write-gate.sh and asserts the decision.
#   bash tools/sandbox/write-gate-test.sh
#
# Runs anywhere. NETFLIX_JOBS_GATE_FORCE=1 switches off the container
# heuristics (/.dockerenv, /workspace) so the gate can be exercised for real
# from inside the sandbox, where it would otherwise allow everything. It cannot
# loosen the gate -- NETFLIX_JOBS_SANDBOX_INNER still wins, which is the last
# case below.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
GATE="$SCRIPT_DIR/outer-write-gate.sh"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"

pass=0
fail=0

# $1 want, $2 label, $3 payload JSON, $4 optional env assignment
check() {
  local want="$1" label="$2" json="$3" env_extra="${4:-}" got
  got="$(printf '%s' "$json" |
    env -u NETFLIX_JOBS_SANDBOX_INNER NETFLIX_JOBS_GATE_FORCE=1 ${env_extra:+$env_extra} \
      bash "$GATE" 2>/dev/null |
    jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null)"

  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
    printf 'ok    %-5s  %s\n' "$got" "$label"
    return 0
  fi
  fail=$((fail + 1))
  printf 'FAIL  want=%s got=%s  %s\n' "$want" "${got:-<none>}" "$label"
}

edit_json() { jq -nc --arg p "$1" '{tool_name:"Edit",tool_input:{file_path:$p}}'; }
write_json() { jq -nc --arg p "$1" '{tool_name:"Write",tool_input:{file_path:$p}}'; }

# The hole this gate exists to close: outer hand-editing a source file on the Mac.
check deny 'source file is denied' \
  "$(edit_json "$ROOT/apps/web/src/app/(site)/site-footer.css")"

# The harness is outer's own wiring; it must stay editable or outer cannot repair
# the thing that dispatches to inner.
check allow 'new script under tools/sandbox' "$(write_json "$ROOT/tools/sandbox/foo.sh")"
check allow 'settings under .claude' "$(write_json "$ROOT/.claude/settings.json")"
check allow 'nested under .claude' "$(write_json "$ROOT/.claude/skills/sandbox/SKILL.md")"

# Path tricks. The prefix check is only worth anything if the path is resolved
# first -- both directions.
check deny 'traversal escapes the repo' "$(edit_json "$ROOT/tools/sandbox/../../../etc/passwd")"
check deny 'traversal out of an allowed dir into source' \
  "$(edit_json "$ROOT/.claude/../apps/web/next.config.ts")"
check allow 'traversal that lands back inside the harness' \
  "$(edit_json "$ROOT/.claude/../tools/sandbox/boot.sh")"
check deny 'absolute path outside the repo' "$(edit_json /etc/hosts)"
check deny 'a path with no existing ancestor inside the repo' \
  "$(edit_json "$ROOT/nope/../../../../tmp/x")"

# Relative paths are resolved against the payload's cwd.
check allow 'relative path under the harness' \
  "$(jq -nc --arg c "$ROOT" '{tool_name:"Write",cwd:$c,tool_input:{file_path:"tools/sandbox/x.sh"}}')"
check deny 'relative path into source' \
  "$(jq -nc --arg c "$ROOT" '{tool_name:"Write",cwd:$c,tool_input:{file_path:"apps/web/next.config.ts"}}')"

# The other tool shapes.
check deny 'NotebookEdit notebook_path' \
  "$(jq -nc --arg p "$ROOT/apps/web/x.ipynb" '{tool_name:"NotebookEdit",tool_input:{notebook_path:$p}}')"
check allow 'MultiEdit on a harness file' \
  "$(jq -nc --arg p "$ROOT/tools/sandbox/boot.sh" \
    '{tool_name:"MultiEdit",tool_input:{file_path:$p,edits:[{old_string:"a",new_string:"b"}]}}')"
check deny 'a per-edit file_path outside the harness is judged too' \
  "$(jq -nc --arg a "$ROOT/tools/sandbox/boot.sh" --arg b "$ROOT/apps/web/next.config.ts" \
    '{tool_name:"MultiEdit",tool_input:{file_path:$a,edits:[{file_path:$b}]}}')"
check deny 'a write tool with no readable path' '{"tool_name":"Write","tool_input":{}}'

# Not this gate's business.
check allow 'Read passes through' \
  "$(jq -nc --arg p "$ROOT/apps/web/next.config.ts" '{tool_name:"Read",tool_input:{file_path:$p}}')"
check allow 'Bash passes through (outer-gate.sh judges those)' \
  '{"tool_name":"Bash","tool_input":{"command":"git push"}}'

# The bypass. Inner IS the sandbox, so the gate must never fire on it -- and the
# explicit signal outranks the force flag the rest of this file runs under.
check allow 'NETFLIX_JOBS_SANDBOX_INNER allows the denied case' \
  "$(edit_json "$ROOT/apps/web/src/app/(site)/site-footer.css")" \
  NETFLIX_JOBS_SANDBOX_INNER=1

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
