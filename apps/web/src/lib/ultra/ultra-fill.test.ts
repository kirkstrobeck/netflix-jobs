import { afterEach, describe, expect, it, vi } from "vitest";

import { ULTRA_HEADROOM } from "@/lib/ultra/ultra-config";
import { startUltraFill } from "@/lib/ultra/ultra-fill";

// jsdom has no WebGPU and no canvas backend, so every collaborator here is a
// stand-in. What is under test is the sequence -- which of adapter, device and
// context is missing, and what the element is told about it -- not the GPU.

function fakeDevice() {
  const pass = { end: vi.fn() };
  const encoder = {
    beginRenderPass: vi.fn(() => pass),
    finish: vi.fn(() => "commands"),
  };

  return {
    pass,
    encoder,
    createCommandEncoder: vi.fn(() => encoder),
    queue: { submit: vi.fn() },
    destroy: vi.fn(),
  };
}

function fakeContext() {
  return {
    configure: vi.fn(),
    getCurrentTexture: vi.fn(() => ({ createView: vi.fn(() => "view") })),
  };
}

function fakeCanvas(context: unknown) {
  return {
    dataset: {} as Record<string, string>,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement & { dataset: Record<string, string> };
}

function stubGpu(gpu: unknown) {
  vi.stubGlobal("navigator", { ...globalThis.navigator, gpu });
}

// The async setup is a floating promise by design -- startUltraFill returns a
// handle synchronously. One microtask turn per await in it.
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startUltraFill", () => {
  it("paints the canvas at the site's headroom", async () => {
    const device = fakeDevice();
    const context = fakeContext();
    const canvas = fakeCanvas(context);

    stubGpu({ requestAdapter: async () => ({ requestDevice: async () => device }) });
    startUltraFill(canvas);
    await settled();

    // rgba16float with extended tone mapping IS the technique: it is the only
    // surface on which a value above 1.0 reaches display headroom instead of
    // clamping at reference white.
    expect(context.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "rgba16float",
        toneMapping: { mode: "extended" },
      }),
    );
    expect(device.encoder.beginRenderPass).toHaveBeenCalledWith(
      expect.objectContaining({
        colorAttachments: [
          expect.objectContaining({
            clearValue: {
              r: ULTRA_HEADROOM,
              g: ULTRA_HEADROOM,
              b: ULTRA_HEADROOM,
              a: 1,
            },
          }),
        ],
      }),
    );
    expect(device.queue.submit).toHaveBeenCalledWith(["commands"]);
    expect(canvas.dataset.ultraFill).toBe("on");
  });

  it("takes a per-call intensity over the site's headroom", async () => {
    const device = fakeDevice();
    const canvas = fakeCanvas(fakeContext());

    stubGpu({ requestAdapter: async () => ({ requestDevice: async () => device }) });
    startUltraFill(canvas, { intensity: 3 });
    await settled();

    expect(device.encoder.beginRenderPass).toHaveBeenCalledWith(
      expect.objectContaining({
        colorAttachments: [
          expect.objectContaining({ clearValue: { r: 3, g: 3, b: 3, a: 1 } }),
        ],
      }),
    );
  });

  // Three ways to have no GPU, and one answer to all of them: say so on the
  // element and let ultra.css hand the headline its ordinary ink back.
  it("marks the canvas unsupported when the browser has no WebGPU", async () => {
    const canvas = fakeCanvas(fakeContext());

    stubGpu(undefined);
    startUltraFill(canvas);
    await settled();

    expect(canvas.dataset.ultraFill).toBe("unsupported");
  });

  it("marks it unsupported when there is no adapter", async () => {
    const canvas = fakeCanvas(fakeContext());

    stubGpu({ requestAdapter: async () => null });
    startUltraFill(canvas);
    await settled();

    expect(canvas.dataset.ultraFill).toBe("unsupported");
  });

  it("gives the device back when the canvas has no webgpu context", async () => {
    const device = fakeDevice();
    const canvas = fakeCanvas(null);

    stubGpu({ requestAdapter: async () => ({ requestDevice: async () => device }) });
    startUltraFill(canvas);
    await settled();

    expect(device.destroy).toHaveBeenCalled();
    expect(canvas.dataset.ultraFill).toBe("unsupported");
  });

  // The component can unmount while the adapter is still handing a device over.
  // Nothing owns it by then, so it is destroyed rather than left to the GC.
  it("destroys a device that arrives after the session stopped", async () => {
    const device = fakeDevice();
    const canvas = fakeCanvas(fakeContext());

    stubGpu({ requestAdapter: async () => ({ requestDevice: async () => device }) });
    startUltraFill(canvas).stop();
    await settled();

    expect(device.destroy).toHaveBeenCalled();
    expect(canvas.dataset.ultraFill).toBeUndefined();
  });

  it("repaints on poke, and does nothing before the device arrives", async () => {
    const device = fakeDevice();
    const canvas = fakeCanvas(fakeContext());

    stubGpu({ requestAdapter: async () => ({ requestDevice: async () => device }) });
    const session = startUltraFill(canvas);

    session.poke();
    expect(device.createCommandEncoder).not.toHaveBeenCalled();

    await settled();
    session.poke();
    expect(device.createCommandEncoder).toHaveBeenCalledTimes(2);
  });

  it("stops painting once stopped", async () => {
    const device = fakeDevice();
    const canvas = fakeCanvas(fakeContext());

    stubGpu({ requestAdapter: async () => ({ requestDevice: async () => device }) });
    const session = startUltraFill(canvas);
    await settled();

    session.stop();
    session.poke();

    expect(device.destroy).toHaveBeenCalled();
    expect(device.createCommandEncoder).toHaveBeenCalledTimes(1);
  });
});
