#!/usr/bin/env bash
set -euo pipefail

# Renders inner Claude's live transcript as readable one-liners, so the outer
# agent can report progress during a long dispatch.
#
#   tail.sh            last 40 events
#   tail.sh -n 100     last 100 events
#   tail.sh -f         follow

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
sandbox_docker_host

lines=40
follow=0
while [ $# -gt 0 ]; do
  case "$1" in
    -n) lines="$2"; shift 2 ;;
    -f) follow=1; shift ;;
    *) echo "usage: tail.sh [-n LINES] [-f]" >&2; exit 2 ;;
  esac
done

# Inner's session transcripts live under the project slug for /workspace.
session_file() {
  docker exec "$SANDBOX_NAME" sh -c \
    'ls -t /home/agent/.claude/projects/-workspace/*.jsonl 2>/dev/null | head -1'
}

FILTER='
  if .type == "assistant" then
    (.message.content // [])[] |
      if .type == "text" and (.text | length) > 0 then "ASSISTANT: " + .text
      elif .type == "thinking" then "ASSISTANT [thinking] " + (.thinking // "")
      elif .type == "tool_use" then "ASSISTANT -> " + .name + " " + ((.input // {}) | tostring)
      else empty end
  elif .type == "user" then
    (.message.content // []) |
      if type == "array" then
        .[] | if .type == "tool_result" then
          "USER <- result " + ((.content // "") | tostring)
        else empty end
      else empty end
  else empty end
'

render() {
  jq -r --unbuffered "$FILTER" 2>/dev/null | cut -c1-240
}

file="$(session_file)"
if [ -z "$file" ]; then
  echo "No inner session transcript yet — has dispatch.sh run?" >&2
  exit 0
fi

if [ "$follow" = "1" ]; then
  docker exec "$SANDBOX_NAME" tail -n "$lines" -f "$file" | render
  exit 0
fi

docker exec "$SANDBOX_NAME" tail -n "$lines" "$file" | render
