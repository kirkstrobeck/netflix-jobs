#!/usr/bin/env bash
set -euo pipefail

# Copies a file from the Mac into the repo.
#   bash tools/sandbox/import-asset.sh <host-path> <repo-relative-dest> [--force]
#
# The one thing neither agent can otherwise do. Inner only ever sees /workspace,
# so a user's file sitting in ~/Downloads is invisible to it; outer can see the
# file but outer-gate.sh denies `cp`, and correctly -- a bare copy command is
# indistinguishable from outer editing the tree by hand.
#
# So the capability gets a script instead of an exemption. `bash
# tools/sandbox/*.sh` is already outer's to run, and a named script is
# reviewable in a way an ad-hoc `cp` is not: this one moves bytes and nothing
# else. It cannot write outside the repo, cannot clobber, and does not
# transform what it copies -- converting, renaming and wiring the asset up are
# inner's work, done in the container on a file that is by then simply part of
# the tree.
#
# The repo is bind-mounted at /workspace, so the copy lands in the container the
# instant it lands on the Mac. No docker cp, no restart.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

usage() {
  echo "usage: bash tools/sandbox/import-asset.sh <host-path> <repo-relative-dest> [--force]" >&2
  exit 2
}

src="${1:-}"
dest="${2:-}"
force="${3:-}"
[ -n "$src" ] || usage
[ -n "$dest" ] || usage

if [ -n "$force" ] && [ "$force" != "--force" ]; then
  usage
fi

if [ ! -f "$src" ]; then
  echo "import-asset: no such file: $src" >&2
  exit 1
fi

# Destination is repo-relative by definition. An absolute path is not a
# narrower case of that, it is a different instruction -- reject rather than
# guess which one was meant.
case "$dest" in
  /*)
    echo "import-asset: destination must be repo-relative, got absolute path: $dest" >&2
    exit 1
    ;;
esac

# Belt and braces with the resolved check below. This catches the traversal in
# the literal argument; the pwd -P check catches one that arrives through a
# symlinked ancestor.
case "/$dest/" in
  */../*)
    echo "import-asset: destination may not contain ..: $dest" >&2
    exit 1
    ;;
esac

full="$REPO_ROOT/$dest"

if [ -e "$full" ] && [ "$force" != "--force" ]; then
  echo "import-asset: $dest already exists (pass --force to overwrite)" >&2
  exit 1
fi

mkdir -p "$(dirname "$full")"

# Resolve after mkdir so the parent exists to pwd -P. A symlinked component
# anywhere in the destination is what this is for: tools/sandbox/x -> /etc
# passes every lexical check above and still writes outside the repo.
parent="$(cd "$(dirname "$full")" && pwd -P)"
resolved="$parent/$(basename "$full")"
case "$resolved/" in
  "$REPO_ROOT/"*) ;;
  *)
    echo "import-asset: $dest resolves to $resolved, outside the repo" >&2
    exit 1
    ;;
esac

cp "$src" "$resolved"

echo "imported $(basename "$src") -> $dest" >&2
printf '%s\n' "$dest"
