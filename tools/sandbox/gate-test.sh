#!/usr/bin/env bash
set -uo pipefail

# Feeds hook payloads to outer-gate.sh and asserts the decision. Run from the
# Mac: bash tools/sandbox/gate-test.sh
#
# The gate is the only thing standing between a careless outer-agent command
# and the host's real repo, so its edge cases need to be pinned down. It is
# also load-bearing in the other direction — over-strict rules block dispatch
# and there is then no way to do any work at all.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
GATE="$SCRIPT_DIR/outer-gate.sh"

pass=0
fail=0

check() {
  local want="$1" label="$2" cmd="$3" got
  got="$(jq -nc --arg c "$cmd" '{tool_name:"Bash",tool_input:{command:$c}}' |
    bash "$GATE" 2>/dev/null | jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null)"

  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
    printf 'ok    %-5s  %s\n' "$got" "$label"
    return 0
  fi
  fail=$((fail + 1))
  printf 'FAIL  want=%s got=%s  %s\n' "$want" "${got:-<none>}" "$label"
}

# If this one passes we know the gate is actually engaging. It fails open on
# internal error and self-bypasses inside the container, so a run that somehow
# thinks it is in the sandbox would allow everything below.
check deny 'git is hard-denied' 'git push'
check deny 'toolchain is hard-denied' 'pnpm install'
check deny 'supabase lifecycle denied' 'supabase db reset'

# The regression: a quoted argument is text, not syntax. Every one of these was
# denied before the skeleton scan, which made dispatch unusable.
check allow 'dispatch with ; in the message' \
  "bash tools/sandbox/dispatch.sh 'commit this; then report back'"
check allow 'dispatch with | in the message' \
  "bash tools/sandbox/dispatch.sh 'run a | b and tell me'"
check allow 'dispatch with a multi-line message' \
  "bash tools/sandbox/dispatch.sh 'line one
line two'"
check allow 'dispatch with backticks in the message' \
  "bash tools/sandbox/dispatch.sh 'show me \`git status\`'"
check allow 'docker exec with a quoted pipeline payload' \
  "docker exec netflix-jobs-sandbox-63ee8bf2 sh -c 'ps aux | grep next'"

# Real chaining still has to lose, or the allow-prefix rules are decorative.
check deny 'chained onto an allowed entry point' \
  'bash tools/sandbox/boot.sh; git push'
check deny 'chained with &&' \
  'bash tools/sandbox/boot.sh && git push'
check deny 'piped into a denied command' \
  'echo x | git push'
check deny 'command substitution in double quotes stays live' \
  'bash tools/sandbox/boot.sh "$(git rev-parse HEAD)"'
check deny 'backtick substitution stays live' \
  'bash tools/sandbox/boot.sh `git rev-parse HEAD`'
check deny 'unterminated quote is treated as chained' \
  "bash tools/sandbox/boot.sh 'oops"

# Loopback probes are outer's job; anything else on the wire is inner's.
check allow 'loopback curl' 'curl -s http://localhost:3000/'
check allow 'loopback curl by ip' 'curl -sI http://127.0.0.1:3000/'
check deny 'curl to the internet' 'curl -s https://example.com'
check deny 'loopback curl piped somewhere' 'curl -s http://localhost:3000/ | jq .'

# Plain utilities, unchained.
check allow 'echo' 'echo hello'
check allow 'open' 'open -a "Google Chrome" http://localhost:3000/'
check allow 'read-only docker' 'docker ps --format {{.Names}}'
check allow 'empty command' ''

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
