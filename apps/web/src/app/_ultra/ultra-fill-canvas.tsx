// Ultra mode by Kirk Strobeck – https://UltraDarkMode.com

"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { startUltraFill } from "@/lib/ultra/ultra-fill";

type UltraFillCanvasProps = {
  /** Overrides ULTRA_HEADROOM for this one fill. */
  intensity?: number;
  /** True once the surface is painting, false when there is no WebGPU. */
  onPainting?: (painting: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * A rectangle of Ultra white. Shape it with a CSS mask on the caller's terms.
 *
 * The element is held in state rather than a ref because the effect has to run
 * again when it arrives: a ref's .current is not a dependency, so an effect
 * keyed on it would either read null forever or need a lint suppression to
 * pretend otherwise. A callback ref makes the mount an ordinary render.
 *
 * aria-hidden and pointer-events: none, both load-bearing. The canvas sits over
 * the real text, and without them it swallows the selection of the words
 * underneath it.
 */
export function UltraFillCanvas({
  intensity,
  onPainting,
  className,
  style,
}: UltraFillCanvasProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const session = startUltraFill(canvas, { intensity, onPainting });
    // WebGPU surfaces are dropped on tab restore and on resize, and a dropped
    // surface paints nothing -- which, through the mask, is an invisible
    // headline rather than a dim one.
    const repaint = () => session.poke();

    document.addEventListener("visibilitychange", repaint);
    window.addEventListener("resize", repaint);

    return () => {
      document.removeEventListener("visibilitychange", repaint);
      window.removeEventListener("resize", repaint);
      session.stop();
    };
  }, [canvas, intensity, onPainting]);

  return (
    <canvas
      aria-hidden
      className={className ? `ultra-fill ${className}` : "ultra-fill"}
      height={1}
      ref={setCanvas}
      style={style}
      width={1}
    />
  );
}
