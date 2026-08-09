import desktopConfig from "lighthouse/core/config/desktop-config.js";

// Every category this Lighthouse reports, in report order. Not hardcoded
// optimism: main.mjs asserts this list equals Object.keys of the default
// config's categories, so a Lighthouse upgrade that adds one fails the gate
// rather than silently leaving it unmeasured.
export const CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
  "agentic-browsing",
];

export const PASSING = 100;

// Three runs, median score. One run is a coin flip on a shared machine: a
// background compile or another container's I/O lands in the trace and takes
// 4 points off performance for reasons that have nothing to do with the code.
// The median of three throws out one bad sample in either direction, which is
// the cheapest defence that still fails honestly -- two bad runs out of three
// is a real regression, not noise.
export const RUNS = 3;

// Desktop, simulated (Lantern) throttling. Deliberate, on three counts:
//
// 1. Simulated over devtools/provided. Lantern measures the page unthrottled
//    and then models the network against a fixed RTT and throughput, so the
//    number does not move with whatever else is competing for the NIC. DevTools
//    throttling injects real delays and inherits real contention; `provided`
//    measures the host, which here is an arm64 VM behind virtiofs and is not a
//    machine anyone browses from.
//
// 2. Desktop over mobile. The mobile preset multiplies observed CPU time by 4.
//    That multiplier does not just slow the simulated device down, it amplifies
//    measurement noise by 4 as well -- a 30ms scheduling hiccup on a loaded
//    container becomes 120ms of simulated main-thread work. On a jobs board
//    served to laptop browsers, that is a lot of variance bought for a device
//    profile the traffic does not have.
//
// 3. cpuQuietThresholdMs raised from Lighthouse's 1000ms default. The page runs
//    an ambient CSS animation in the footer; the default quiet threshold can
//    end the trace while compositor frames are still landing, which reads as
//    main-thread work that never settles. 2000ms lets the page actually finish.
export const config = {
  ...desktopConfig,
  settings: {
    ...desktopConfig.settings,
    throttlingMethod: "simulate",
    cpuQuietThresholdMs: 2000,
    pauseAfterFcpMs: 2000,
    pauseAfterLoadMs: 2000,
  },
};

export const CHROME_FLAGS = [
  // No sandbox: the container has no user namespaces to build one from, and the
  // container is already the trust boundary.
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--headless=new",
  // Chrome's own background work -- component updates, optimization hints,
  // first-run network calls -- shows up in the trace as main-thread time and
  // as requests the page did not make.
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-sync",
];
