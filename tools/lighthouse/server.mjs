import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} exited ${code}`));
    });
  });
}

export async function build() {
  await run("pnpm", ["--filter", "web", "build"], "next build");
}

// `next start`, never `next dev`. The dev server compiles on demand, ships
// unminified modules with the React refresh runtime attached, and serves no
// immutable cache headers -- so its performance number measures the compiler,
// not the site. Everything downstream of this is a production build.
export async function start(port) {
  const child = spawn(
    "pnpm",
    ["--filter", "web", "exec", "next", "start", "--port", String(port)],
    { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );

  const output = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  const stop = async () => {
    child.kill("SIGTERM");
    await sleep(200);
    child.kill("SIGKILL");
  };

  await waitForReady(`http://127.0.0.1:${port}/`, child, output, stop);

  return { stop, output };
}

async function waitForReady(url, child, output, stop) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next start died:\n${output.join("")}`);
    }

    const ok = await fetch(url, { redirect: "manual" })
      .then((response) => response.status < 500)
      .catch(() => false);

    if (ok) {
      return;
    }

    await sleep(250);
  }

  await stop();
  throw new Error(`next start never answered on ${url}:\n${output.join("")}`);
}

// One throwaway request per URL before anything is measured. The first hit on a
// cold `next start` pays for filling the incremental cache and opening the
// upstream connection to Supabase, and that cost is the server's startup, not
// the page's. Measuring it once would be fair; measuring it in run 1 of 3 and
// not in runs 2 and 3 is just noise with a bias.
export async function warm(urls) {
  for (const url of urls) {
    await fetch(url).then((response) => response.text());
  }
}
