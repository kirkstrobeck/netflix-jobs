#!/usr/bin/env node
// Host FSEvents → container content MODIFY.
//
// Cursor saves via temp+rename. Virtiofs updates the guest bytes, but Colima's
// mount-inotify daemon never chmod-injects those renames, so Turbopack keeps
// serving the old module (hard refresh included). This bridge watches the Mac
// tree and rewrites the matching guest path so Next sees a real MODIFY.
//
// Args: <repoRoot> <sandboxContainerName>

import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2];
const sandboxName = process.argv[3];

if (!repoRoot || !sandboxName) {
  console.error("usage: host-fs-bridge.mjs <repoRoot> <sandboxName>");
  process.exit(1);
}

const watchRoot = path.join(repoRoot, "apps/web/src");
const SOURCE_RE = /\.(tsx?|jsx?|mjs|cjs|css|json)$/;
const DEBOUNCE_MS = 200;

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pending = new Map();

function rewriteGuest(relPath) {
  const guest = path.posix.join("/workspace/apps/web/src", relPath.split(path.sep).join("/"));
  // dd conv=notrunc rewrites bytes without truncating to empty mid-write
  // (a truncate+write races Turbopack and yields "not a React Component").
  const script = `f=${JSON.stringify(guest)}; test -f "$f" || exit 0; dd if="$f" of="$f" conv=notrunc status=none`;

  const child = spawn(
    "docker",
    ["exec", "-u", `${process.getuid()}:${process.getgid()}`, sandboxName, "sh", "-c", script],
    { stdio: "ignore" },
  );
  child.on("error", (err) => {
    console.error("docker exec failed:", err.message);
  });
}

function onEvent(_eventType, filename) {
  if (!filename || !SOURCE_RE.test(filename)) {
    return;
  }
  const prev = pending.get(filename);
  if (prev) {
    clearTimeout(prev);
  }
  pending.set(
    filename,
    setTimeout(() => {
      pending.delete(filename);
      rewriteGuest(filename);
    }, DEBOUNCE_MS),
  );
}

watch(watchRoot, { recursive: true }, onEvent);
console.error(`host-fs-bridge watching ${watchRoot} → ${sandboxName}`);
