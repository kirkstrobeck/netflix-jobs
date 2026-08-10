// What does scrolling an Ultra element out of view and back actually cost?
//
// This machine has no WebGPU adapter, so the real allocation path never runs
// here and the canvas reports "unsupported". A stub navigator.gpu is installed
// before the page loads, implementing exactly the surface ultra-fill.ts touches
// -- requestAdapter, requestDevice, getContext("webgpu"), configure, a render
// pass, destroy -- and counting every call with a timestamp. The application
// code is unmodified and takes its normal path through all of it.
//
// That makes the interesting numbers measurable without a GPU:
//
//   devices     how many GPUDevices were requested over the whole visit
//   destroys    how many were destroyed
//   configures  how many times the canvas context was reconfigured
//   paints      how many render passes were submitted
//   reentryMs   from scrolling the element back into view to the next paint
//
// A correct implementation allocates once and paints again on re-entry: devices
// 1, destroys 0, configures 1, paints going up by 1. Any rise in devices,
// destroys or configures across a scroll cycle is a rebuild, and a rebuild is
// what the visitor sees as a delay.
//
// Usage: node tools/probe/ultra-reentry.mjs [origin] [path]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3000";
const PATH = process.argv[3] ?? "/jobs/JR41734";
const CYCLES = 3;

const STUB = () => {
  const log = {
    adapters: 0,
    devices: 0,
    destroys: 0,
    contexts: 0,
    configures: 0,
    paints: 0,
    lastPaintAt: 0,
  };
  window.__ultra = log;

  const pass = { end() {} };
  const encoder = {
    beginRenderPass() {
      log.paints += 1;
      log.lastPaintAt = performance.now();
      return pass;
    },
    finish: () => ({}),
  };
  const device = {
    createCommandEncoder: () => encoder,
    queue: { submit() {} },
    destroy() {
      log.destroys += 1;
    },
  };

  // defineProperty, not assignment: navigator.gpu is an accessor on the
  // prototype in Chromium, so a plain assignment is silently dropped.
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      async requestAdapter() {
        log.adapters += 1;
        return {
          async requestDevice() {
            log.devices += 1;
            return device;
          },
        };
      },
    },
  });

  // getContext("webgpu") is the allocation this file cares most about: it is the
  // surface, and reconfiguring it is the expensive half of a rebuild.
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(kind, ...rest) {
    if (kind !== "webgpu") return real.call(this, kind, ...rest);
    log.contexts += 1;
    return {
      configure() {
        log.configures += 1;
      },
      getCurrentTexture: () => ({ createView: () => ({}) }),
    };
  };
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(STUB);
await page.goto(ORIGIN + PATH, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__ultra && window.__ultra.paints > 0);

console.log(`origin ${ORIGIN}${PATH}`);
console.log("after first paint:", JSON.stringify(await page.evaluate(() => ({ ...window.__ultra, lastPaintAt: undefined }))));

for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
  const reading = await page.evaluate(async () => {
    const before = { ...window.__ultra };

    // Out of view, and long enough for anything watching to have acted.
    window.scrollTo(0, 4000);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const offScreen = { ...window.__ultra };

    // Back, and time to the next paint.
    const returnedAt = performance.now();
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const after = { ...window.__ultra };

    return {
      devices: after.devices - before.devices,
      destroys: after.destroys - before.destroys,
      contexts: after.contexts - before.contexts,
      configures: after.configures - before.configures,
      paints: after.paints - before.paints,
      paintedWhileOffScreen: offScreen.paints - before.paints,
      reentryMs:
        after.paints > offScreen.paints
          ? +(after.lastPaintAt - returnedAt).toFixed(1)
          : null,
    };
  });

  console.log(`cycle ${cycle}:`, JSON.stringify(reading));
}

console.log("totals:", JSON.stringify(await page.evaluate(() => ({ ...window.__ultra, lastPaintAt: undefined }))));

await browser.close();
