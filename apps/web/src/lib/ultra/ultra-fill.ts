// Ultra mode - https://UltraDarkMode.com

/**
 * A flat extended-range fill on a WebGPU canvas.
 *
 * Ultra white cannot be expressed in CSS paint. It needs an `rgba16float`
 * surface with `toneMapping: { mode: "extended" }`, where values above 1.0 map
 * onto the display's headroom instead of clamping at reference white. There is
 * no CSS fallback that gets close: `background-clip: text` with an HDR colour
 * clamps, and SVG <text> with `fill: color-hdr(...)` was built and compared side
 * by side at the same 2.2 headroom and read as plain SDR white.
 *
 * The canvas is 1x1. The fill is uniform, so CSS scales the single texel to size
 * and a mask decides what shape it takes -- no resize observer, no dpr maths,
 * no per-pixel shader.
 */

import { ULTRA_HEADROOM } from "@/lib/ultra/ultra-config";

/*
  Minimal structural WebGPU types, so this compiles without @webgpu/types. The
  app has no other WebGPU surface, and a dependency for four object shapes is a
  dependency to keep in step with a spec that is still moving.
*/
type UltraRenderPass = { end(): void };
type UltraCommandEncoder = {
  beginRenderPass(descriptor: Record<string, unknown>): UltraRenderPass;
  finish(): unknown;
};
type UltraDevice = {
  createCommandEncoder(): UltraCommandEncoder;
  queue: { submit(buffers: unknown[]): void };
  destroy(): void;
};
type UltraContext = {
  configure(descriptor: Record<string, unknown>): void;
  getCurrentTexture(): { createView(): unknown };
};
type UltraAdapter = { requestDevice(): Promise<UltraDevice> };
type UltraGpu = { requestAdapter(): Promise<UltraAdapter | null> };

/** GPUTextureUsage.RENDER_ATTACHMENT, inlined so no ambient global is needed. */
const RENDER_ATTACHMENT = 0x10;

export type UltraFillSession = {
  /** Redraw. WebGPU surfaces are dropped on resize and on tab restore. */
  poke(): void;
  stop(): void;
};

export type UltraFillOptions = {
  /** Overrides ULTRA_HEADROOM for this one fill. */
  intensity?: number;
  /**
   * True once the surface is configured and painted, false when there is no
   * WebGPU to paint with. The headline gives up its own ink only on true.
   */
  onPainting?: (painting: boolean) => void;
};

function paint(device: UltraDevice, surface: UltraContext, intensity: number): void {
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: surface.getCurrentTexture().createView(),
        clearValue: { r: intensity, g: intensity, b: intensity, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  pass.end();
  device.queue.submit([encoder.finish()]);
}

/**
 * Start painting `canvas`, and say so on the element.
 *
 * `data-ultra-fill` is the whole support story, and it is an attribute rather
 * than React state because the thing that has to react to it is CSS: no WebGPU,
 * no adapter or no context leaves it "unsupported", ultra.css hides the canvas
 * and hands the headline its ordinary ink back. There is no second technique to
 * fall back to -- the word simply renders as plain SDR white.
 */
export function startUltraFill(
  canvas: HTMLCanvasElement,
  options: UltraFillOptions = {},
): UltraFillSession {
  const intensity = options.intensity ?? ULTRA_HEADROOM;
  let device: UltraDevice | undefined;
  let surface: UltraContext | undefined;
  let stopped = false;

  const unsupported = () => {
    canvas.dataset.ultraFill = "unsupported";
    options.onPainting?.(false);
  };

  void (async () => {
    const gpu = (navigator as unknown as { gpu?: UltraGpu }).gpu;
    if (!gpu) return unsupported();

    const adapter = await gpu.requestAdapter();
    if (!adapter) return unsupported();

    const next = await adapter.requestDevice();
    // The component may have unmounted while the adapter was being handed over.
    // Nothing owns this device but the session that is already over.
    if (stopped) return next.destroy();

    const context = canvas.getContext("webgpu") as UltraContext | null;
    if (!context) {
      next.destroy();
      return unsupported();
    }

    context.configure({
      device: next,
      format: "rgba16float",
      colorSpace: "srgb",
      toneMapping: { mode: "extended" },
      alphaMode: "premultiplied",
      usage: RENDER_ATTACHMENT,
    });

    device = next;
    surface = context;
    paint(device, surface, intensity);
    canvas.dataset.ultraFill = "on";
    options.onPainting?.(true);
  })();

  return {
    poke() {
      // Nothing to repaint before the device arrives -- and the first paint,
      // when it does, is the one this would have been.
      if (!device || !surface) return;

      paint(device, surface, intensity);
    },
    stop() {
      stopped = true;
      device?.destroy();
      device = undefined;
      surface = undefined;
    },
  };
}
