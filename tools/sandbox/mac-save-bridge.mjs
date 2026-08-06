#!/usr/bin/env node
// Mac save -> guest inotify MODIFY. Runs INSIDE the sandbox container.
//
// The problem: apps/web/src is a virtiofs bind mount of the Mac's disk. When
// Cursor saves, the bytes cross immediately -- but the inotify event does not.
// Turbopack's native watcher is watching a tree that, from its point of view,
// never changes, so nothing recompiles until the dev server is restarted.
//
// What this is NOT: the previous fixes (Colima --mount-inotify, inotify-
// amplify.sh, host-fs-bridge.mjs) all manufactured the missing event by writing
// the file from the OTHER side of the mount, and every such write propagates
// back across it and retriggers whatever was watching. host-fs-bridge fed itself
// directly -- its docker exec `dd` landed on the macOS file, FSEvents fired, and
// it rewrote again ~12x/second, forever. Measured before removal: 34 inotify
// events in a 15s window on a file nobody touched.
//
// This does not watch for events at all, so it cannot be retriggered by one. It
// polls mtime, and it remembers the mtime its own rewrite produced -- so its
// write is not a change the next pass can see. Nothing on the Mac watches this
// tree any more either, so the rewrite propagating outward has no listener.
//
// Why polling here and not watchOptions.pollIntervalMs: Turbopack polls from
// the monorepo root (20,713 files, 2.5-12s/pass on virtiofs). This polls the 71
// files under src (41-100ms/pass) and hands the result to the native watcher,
// which turns an edit into a rebuild in ~91ms.

import { closeSync, openSync, readFileSync, readdirSync, statSync, writeSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? "/workspace/apps/web/src";
const intervalMs = Number(process.argv[3] ?? 250);
const SOURCE_RE = /\.(tsx?|jsx?|mjs|cjs|css|json)$/;
const SKIP_DIR = /^(node_modules|\.next|\.git)$/;

/** path -> "mtimeMs:size" as of the last pass, including our own rewrites. */
const seen = new Map();

function scan(dir, out) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.test(entry.name)) {
        continue;
      }
      scan(full, out);
      continue;
    }
    if (!SOURCE_RE.test(entry.name)) {
      continue;
    }
    try {
      const st = statSync(full);
      out.set(full, `${st.mtimeMs}:${st.size}`);
    } catch {
      // vanished mid-scan; the next pass will settle it
    }
  }
  return out;
}

// Rewrite identical bytes at offset 0 with no truncation. A plain writeFile
// truncates first, and Turbopack reading that window sees an empty module and
// reports "not a React Component" -- the failure the old dd conv=notrunc was
// also working around. Same length in, same length out, so there is no window
// where the file on disk is short.
function touchContents(file) {
  let fd;
  try {
    const buf = readFileSync(file);
    if (buf.length === 0) {
      return;
    }
    fd = openSync(file, "r+");
    writeSync(fd, buf, 0, buf.length, 0);
  } catch {
    // unreadable or replaced mid-write; next pass retries
  }
  if (fd !== undefined) {
    closeSync(fd);
  }
}

function pass() {
  const now = scan(root, new Map());

  const changed = [];
  for (const [file, sig] of now) {
    if (seen.get(file) !== sig) {
      changed.push(file);
    }
  }
  for (const file of seen.keys()) {
    if (!now.has(file)) {
      seen.delete(file);
    }
  }

  // First pass only records the baseline -- rewriting all 71 files on startup
  // would hand Turbopack a full-tree invalidation for no reason.
  const priming = seen.size === 0;
  for (const [file, sig] of now) {
    seen.set(file, sig);
  }
  if (priming) {
    return;
  }

  for (const file of changed) {
    touchContents(file);
    // Re-stat AFTER our own write, so the mtime we just caused is the baseline
    // and the next pass sees no change. This is the line that makes the loop
    // impossible rather than merely unlikely.
    try {
      const st = statSync(file);
      seen.set(file, `${st.mtimeMs}:${st.size}`);
    } catch {
      seen.delete(file);
    }
    console.error(`mac-save-bridge: ${path.relative(root, file)}`);
  }
}

console.error(`mac-save-bridge watching ${root} every ${intervalMs}ms`);
pass();
setInterval(pass, intervalMs);
