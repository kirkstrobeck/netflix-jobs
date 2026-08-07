#!/usr/bin/env bash
# Writable named-volume helpers + dev-watch teardown for the sandbox.
# Source from boot.sh after the container is up.

# Named volumes (node_modules, .next) are created root-owned on first use;
# inner runs as the host UID and could not write into them. Derived from the
# container's own mount table rather than a hardcoded list.
writable_volume_mounts() {
  docker inspect -f '{{range .Mounts}}{{.Destination}}
{{end}}' "$SANDBOX_NAME" 2>/dev/null | grep -E '/(node_modules|\.next)$' || true
}

fix_volume_ownership() {
  local targets=()
  while IFS= read -r dest; do
    [ -n "$dest" ] && targets+=("$dest")
  done < <(writable_volume_mounts)
  [ "${#targets[@]}" -gt 0 ] || return 0

  docker exec -u 0 "$SANDBOX_NAME" sh -c \
    "mkdir -p $(printf '%q ' "${targets[@]}") 2>/dev/null; chown $(id -u):$(id -g) $(printf '%q ' "${targets[@]}") 2>/dev/null || true" \
    >/dev/null 2>&1 || true
}

# Both of these existed to manufacture a guest inotify event for a Mac save,
# because virtiofs does not carry one across. Both did it the same way -- write
# the file again from the other side of the mount -- and that rewrite propagates
# back across the mount and retriggers whatever was watching it. host-fs-bridge
# feeds itself directly: its docker exec `dd` lands on the macOS file, macOS
# FSEvents fires, the bridge sees its own write and rewrites again. Its 200ms
# debounce coalesces a burst; it does not break a cycle.
#
# Measured before removal: one appended line produced 24 MODIFY + 9 ATTRIB in
# 16s, then 34 further events in a 15s window with nothing writing at all, and
# the loop survived killing the in-container amplifier -- which is what placed
# the bridge (and Colima's chmod injection) inside it.
#
# tools/sandbox/mac-save-bridge.mjs replaced both -- see ensure_mac_save_bridge
# below, which is the only thing here that starts anything. It is NOT Next
# polling. watchOptions.pollIntervalMs was the obvious fix and was measured and
# rejected: Turbopack polls from `turbopack.root`, the monorepo root, so a pass
# stats 20,713 files instead of the 71 under apps/web/src, and the same edit to
# the same file took 15,400ms against the native watcher's 91ms. next.config.ts
# carries a comment where the setting would go, recording exactly that, and no
# pollIntervalMs -- do not add one back.
#
# So the native watcher stays, and the bridge only feeds it: it polls src alone
# from INSIDE the container and rewrites the changed file in place, which is what
# produces the guest inotify event virtiofs will not carry. The cycle the two
# helpers above fell into is broken by the bridge recording the mtime its own
# rewrite produces, so it cannot mistake its own write for a change.
#
# These stay as stops, not starts, so that booting a workspace that ran the old
# boot.sh clears the strays rather than inheriting them.
stop_dev_watch_helpers() {
  pkill -f 'host-fs-bridge\.mjs' >/dev/null 2>&1 || true
  rm -f "$CACHE_DIR/host-fs-bridge.pid"

  docker exec "$SANDBOX_NAME" pkill -f 'inotify-amplify\.sh' >/dev/null 2>&1 || true
}

# The replacement, and the only one of these that starts anything. Runs INSIDE
# the container -- which is the whole difference: it polls mtime rather than
# waiting for an event, so there is no event that can retrigger it, and it
# records the mtime its own rewrite produces so it cannot see its own write as a
# change. See tools/sandbox/mac-save-bridge.mjs.
ensure_mac_save_bridge() {
  local script="/workspace/tools/sandbox/mac-save-bridge.mjs"
  local src="/workspace/apps/web/src"

  docker exec "$SANDBOX_NAME" pkill -f 'mac-save-bridge\.mjs' >/dev/null 2>&1 || true
  docker exec -d -u "$(id -u):$(id -g)" "$SANDBOX_NAME" \
    node "$script" "$src"
}
