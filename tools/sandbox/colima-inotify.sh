#!/usr/bin/env bash
# Colima VM flags + mount-inotify teardown for the sandbox. Source from boot.sh.
#
# vz + virtiofs stay: they are what make the bind mount fast enough to work in.
# --mount-inotify does NOT. That daemon delivers a host save to the guest by
# chmod'ing the matching guest file, and a chmod is a metadata write that
# propagates straight back out to macOS, where it looks like another host
# change. Combined with tools/sandbox/host-fs-bridge.mjs doing the same trick
# with contents, the two sustained an event storm with no one typing: 34 inotify
# events in a 15s window on an untouched file.
#
# Next polls the tree instead (watchOptions.pollIntervalMs in apps/web/
# next.config.ts), which needs no event to cross the mount at all, so there is
# nothing left for the injection to buy.

colima_start_flags() {
  printf '%s\n' --vm-type vz --mount-type virtiofs
}

# A stop, not a start. A workspace that booted under the old script still has the
# daemon running, and it keeps injecting until something stops it -- so boot.sh
# clearing it is what makes the fix survive into an already-running Colima.
stop_colima_inotify() {
  if ! command -v colima >/dev/null 2>&1; then
    return 0
  fi
  if ! colima status >/dev/null 2>&1; then
    return 0
  fi
  if ! colima_inotify_daemon_running; then
    return 0
  fi

  echo "Stopping Colima mount-inotify daemon (Next polls instead)..." >&2
  colima daemon stop default >/dev/null 2>&1 || true
}

colima_inotify_daemon_running() {
  ps -axo args= | grep -q '[c]olima daemon start.*--inotify'
}
