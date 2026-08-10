// Ultra mode - https://UltraDarkMode.com

"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { startUltraFill } from "@/lib/ultra/ultra-fill";

type UltraFillCanvasProps = {
  /** Overrides ULTRA_HEADROOM for this one fill. */
  intensity?: number;
  /** Linear RGB multiplied by the headroom. Defaults to white. */
  colour?: [number, number, number];
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
 *
 * NOTHING HERE IS DEALLOCATED WHEN THE ELEMENT LEAVES THE VIEWPORT.
 *
 * The device, the surface, the canvas and the mask all stay. Scrolling an Ultra
 * headline away and back has to cost one clear pass, not an adapter request, a
 * device request, a getContext and a configure -- that sequence is what a
 * visitor sees as the word arriving late.
 *
 * This is the opposite of the rule the bars and the glow follow, and
 * deliberately so. Those are CSS keyframe animations: they run continuously, so
 * off-screen they are pure waste, and pause-when-idle.ts parks them with
 * animation-play-state and resumes them where they stopped. An Ultra fill is one
 * flat clear pass that never repeats. There is nothing to park -- pausing it
 * would save nothing, and freeing it would cost the rebuild.
 *
 * The observer here therefore only ever REPAINTS. A WebGPU surface can be
 * dropped by the compositor while it is off screen; a poke on the way back in is
 * what puts the pixels back, and it is a single clear on a 1x1 texture.
 */
export function UltraFillCanvas({
  intensity,
  colour,
  onPainting,
  className,
  style,
}: UltraFillCanvasProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const session = startUltraFill(canvas, { intensity, colour, onPainting });
    // WebGPU surfaces are dropped on tab restore and on resize, and a dropped
    // surface paints nothing -- which, through the mask, is an invisible
    // headline rather than a dim one.
    const repaint = () => session.poke();

    document.addEventListener("visibilitychange", repaint);
    window.addEventListener("resize", repaint);

    // Coming back into view is the third way a surface can be found empty, and
    // it was the one nothing answered: measured over three scroll cycles, no
    // repaint fired at all on re-entry. Repaint only -- the observer never
    // touches the session's allocation.
    const observer = new IntersectionObserver((entries) => {
      if (entries[entries.length - 1].isIntersecting) repaint();
    });

    observer.observe(canvas);

    return () => {
      document.removeEventListener("visibilitychange", repaint);
      window.removeEventListener("resize", repaint);
      observer.disconnect();
      // Unmount, and only unmount. This is the end of the element, not a scroll.
      session.stop();
    };
  }, [canvas, intensity, colour, onPainting]);

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
