#!/usr/bin/env bash
set -uo pipefail

# PreToolUse hook on Bash. Mechanically forces the outer agent to dispatch real
# work into the sandbox instead of running it on the Mac.
#
# Reads the hook payload on stdin, writes a permission decision on stdout.
# Fails OPEN on any internal error — a broken gate must not brick the session.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

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
# NR==1 matters: a bare {print $1} emits the first field of EVERY line, so a
# multi-line command yields a multi-word "first token" that matches no rule.
first="$(printf '%s' "$stripped" | awk 'NR==1{print $1; exit}')"

# The rules below end in `*`, so without this a chained command could ride in
# on an allowed prefix (`bash tools/sandbox/boot.sh; git push`). Anything that
# chains, pipes, or substitutes is ineligible for an allow.
#
# Scanned against the skeleton, not the raw command: operators inside a quoted
# argument are text, and a substring scan cannot tell the difference. That
# mistake made every quoted payload look chained — `dispatch.sh '<message>'`
# was unusable the moment the message contained a semicolon or a newline.
# If skeleton.awk is unavailable, fall back to scanning the raw command: too
# strict, but a broken gate must not brick the session.
skeleton="$(printf '%s' "$stripped" | awk -f "$SCRIPT_DIR/skeleton.awk" 2>/dev/null)"
if [ -z "$skeleton" ]; then
  skeleton="$stripped"
fi

chained=0
case "$skeleton" in
  *';'*|*'&&'*|*'||'*|*'|'*|*'`'*|*'$('*|*$'\n'*) chained=1 ;;
esac

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
if [ "$chained" = 0 ]; then
  case "$stripped" in
    supabase\ stop*|supabase\ status*)
      allow "sandbox administration (supabase teardown/status)" ;;
  esac
fi
case "$first" in
  supabase)
    deny "Supabase lifecycle belongs to inner. $DISPATCH_MSG" ;;
esac

# Docker: read-only inspection plus lifecycle on the sandbox container itself.
if [ "$chained" = 0 ]; then
  case "$stripped" in
    docker\ ps*|docker\ inspect*|docker\ logs*|docker\ image\ inspect*|docker\ volume\ ls*|docker\ info*)
      allow "read-only docker inspection" ;;
    docker\ exec*sandbox*|docker\ restart*sandbox*|docker\ start*sandbox*|docker\ stop*sandbox*|docker\ rm*sandbox*)
      allow "sandbox container administration" ;;
  esac
fi
case "$first" in
  docker|docker-compose)
    deny "Docker beyond sandbox administration belongs to inner. $DISPATCH_MSG" ;;
esac

# The sandbox's own entry points, plus harmless inspection of the harness.
if [ "$chained" = 0 ]; then
  case "$stripped" in
    bash\ -n\ tools/sandbox/*.sh*|bash\ -n\ ./tools/sandbox/*.sh*)
      allow "syntax check of a harness script (parse only, no execution)" ;;
    bash\ tools/sandbox/*.sh*|bash\ ./tools/sandbox/*.sh*)
      allow "sandbox entry point" ;;
    cat\ .claude/*|cat\ tools/sandbox/*|ls\ .claude*|ls\ tools/sandbox*|ls\ -*\ tools/sandbox*|ls\ -*\ .claude*)
      allow "reading sandbox harness files" ;;
  esac
fi

# Guarded by chained too, not just the glob rules above: a first-token allow on
# an unchained command is a judgement about one command, and `echo x | git push`
# is not that command. Now that the skeleton scan only flags real operators,
# holding these to the same bar costs nothing legitimate.
if [ "$chained" = 0 ]; then
  case "$first" in
    pwd|echo|jq|open|lsof|colima|realpath|readlink)
      allow "harness utility" ;;
    kill)
      allow "process cleanup" ;;
  esac
fi

# Loopback reachability checks. Whether a container's published port actually
# answers on the Mac is the one thing inner cannot verify — from inside the
# container it can only reach its own loopback. So outer has to be able to
# probe it. Restricted to http(s) on 127.0.0.1/localhost: a health check, not a
# general fetch tool. Any non-loopback URL in the command disqualifies it.
if [ "$first" = "curl" ]; then
  urls="$(printf '%s' "$stripped" | grep -oE '[a-zA-Z][a-zA-Z0-9+.-]*://[^[:space:]"'"'"']+' || true)"
  if [ "$chained" = 0 ] && [ -n "$urls" ] && ! printf '%s\n' "$urls" |
      grep -qvE '^https?://(127\.0\.0\.1|localhost)(:[0-9]+)?([/?#]|$)'; then
    allow "loopback reachability check"
  fi
  deny "curl to a non-loopback address belongs to inner. $DISPATCH_MSG"
fi

deny "$DISPATCH_MSG"
