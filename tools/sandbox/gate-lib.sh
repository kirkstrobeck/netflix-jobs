#!/usr/bin/env bash
# Shared plumbing for the PreToolUse gates. Source, don't run.
#
# outer-gate.sh (Bash) and outer-write-gate.sh (Edit/Write/MultiEdit/
# NotebookEdit) answer in the same envelope, bypass themselves on the same
# signal, and point at the same dispatch instructions. One copy means a fix to
# the decision shape cannot land in one gate and quietly miss the other -- which
# is exactly how the Edit hole stayed open while Bash was covered.

# Both gates end their deny path with this, so the outer agent always gets the
# same next step rather than two differently-worded dead ends.
DISPATCH_MSG='Do not run this on the host. Dispatch the work to inner Claude: bash tools/sandbox/dispatch.sh "<message>" (or --continue for follow-ups). See .claude/skills/sandbox/SKILL.md.'

decide() {
  local decision="$1" reason="$2"
  jq -nc --arg d "$decision" --arg r "$reason" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  exit 0
}

allow() { decide allow "$1"; }
deny()  { decide deny  "$1"; }

# Inside the container the gates must not apply -- inner IS the sandbox, and a
# gate that fires on inner blocks all real work.
#
# NETFLIX_JOBS_SANDBOX_INNER (set by docker-compose.yml) is the explicit signal;
# /.dockerenv and /workspace are heuristics for a container booted some other
# way. NETFLIX_JOBS_GATE_FORCE=1 turns off only the heuristics, so the gates can
# be exercised for real from inside the container -- it can make a gate stricter,
# never looser, so it is not a way around one.
gate_bypass_if_inner() {
  if [ -n "${NETFLIX_JOBS_SANDBOX_INNER:-}" ]; then
    allow "inside sandbox"
  fi
  if [ -n "${NETFLIX_JOBS_GATE_FORCE:-}" ]; then
    return 0
  fi
  if [ -f /.dockerenv ] || [ -d /workspace ]; then
    allow "inside sandbox"
  fi
}
