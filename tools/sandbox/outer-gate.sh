#!/usr/bin/env bash
set -uo pipefail

# PreToolUse hook on Bash. Mechanically forces the outer agent to dispatch real
# work into the sandbox instead of running it on the Mac.
#
# Reads the hook payload on stdin, writes a permission decision on stdout.
# Fails OPEN on any internal error — a broken gate must not brick the session.

decide() {
  local decision="$1" reason="$2"
  jq -nc --arg d "$decision" --arg r "$reason" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  exit 0
}

allow() { decide allow "$1"; }
deny()  { decide deny  "$1"; }

# Inside the container this hook must not apply — inner IS the sandbox.
if [ -n "${NETFLIX_JOBS_SANDBOX_INNER:-}" ] || [ -f /.dockerenv ] || [ -d /workspace ]; then
  allow "inside sandbox"
fi

payload="$(cat)"
tool="$(printf '%s' "$payload" | jq -r '.tool_name // ""' 2>/dev/null)"
if [ "$tool" != "Bash" ]; then
  allow "not a Bash call"
fi

cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""' 2>/dev/null)"
if [ -z "$cmd" ]; then
  allow "empty command"
fi

# Strip leading VAR=value assignments so the first real token is what we judge.
stripped="$(printf '%s' "$cmd" | sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*//')"
first="$(printf '%s' "$stripped" | awk '{print $1}')"

DISPATCH_MSG='Do not run this on the host. Dispatch the work to inner Claude: bash tools/sandbox/dispatch.sh "<message>" (or --continue for follow-ups). See .claude/skills/sandbox/SKILL.md.'

# Hard denials: no allow_pattern can rescue these, because a clever-looking
# wrapper is exactly how host state gets mutated by accident.
case "$first" in
  git|gh)
    deny "Version control belongs to inner. $DISPATCH_MSG" ;;
  pnpm|npm|npx|yarn|bun|node|deno|turbo|vitest|playwright|next|vercel|tsx|psql)
    deny "Toolchain commands run inside the sandbox. $DISPATCH_MSG" ;;
esac

# Supabase: teardown only. Outer may clean up a stuck local stack; anything
# that creates or migrates goes to inner.
case "$stripped" in
  supabase\ stop*|supabase\ status*)
    allow "sandbox administration (supabase teardown/status)" ;;
esac
case "$first" in
  supabase)
    deny "Supabase lifecycle belongs to inner. $DISPATCH_MSG" ;;
esac

# Docker: read-only inspection plus lifecycle on the sandbox container itself.
case "$stripped" in
  docker\ ps*|docker\ inspect*|docker\ logs*|docker\ image\ inspect*|docker\ volume\ ls*|docker\ info*)
    allow "read-only docker inspection" ;;
  docker\ exec*sandbox*|docker\ restart*sandbox*|docker\ start*sandbox*|docker\ stop*sandbox*|docker\ rm*sandbox*)
    allow "sandbox container administration" ;;
esac
case "$first" in
  docker|docker-compose)
    deny "Docker beyond sandbox administration belongs to inner. $DISPATCH_MSG" ;;
esac

# The sandbox's own entry points, plus harmless inspection of the harness.
case "$stripped" in
  bash\ -n\ tools/sandbox/*.sh*|bash\ -n\ ./tools/sandbox/*.sh*)
    allow "syntax check of a harness script (parse only, no execution)" ;;
  bash\ tools/sandbox/*.sh*|bash\ ./tools/sandbox/*.sh*)
    allow "sandbox entry point" ;;
  cat\ .claude/*|cat\ tools/sandbox/*|ls\ .claude*|ls\ tools/sandbox*|ls\ -*\ tools/sandbox*|ls\ -*\ .claude*)
    allow "reading sandbox harness files" ;;
esac

case "$first" in
  pwd|echo|jq|open|lsof|colima|realpath|readlink)
    allow "harness utility" ;;
  kill)
    allow "process cleanup" ;;
esac

deny "$DISPATCH_MSG"
