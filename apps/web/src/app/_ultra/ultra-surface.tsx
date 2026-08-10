// Ultra mode - https://UltraDarkMode.com

"use client";

import { useId } from "react";

import { UltraFillCanvas } from "@/app/_ultra/ultra-fill-canvas";
import { ULTRA_BLEED } from "@/lib/ultra/ultra-config";

type UltraSurfaceProps = {
  /** The plate's corner radius in px, so the mask matches the real box. */
  radius: number;
  /** Linear RGB multiplied by the headroom. Defaults to white. */
  colour?: [number, number, number];
};

// The overlay layers are grown ULTRA_BLEED past the box on every side, so the
// box itself occupies the middle of the SVG. At a 50% bleed the SVG is 200% and
// the plate is the middle 50%, starting a quarter in.
const INSET = `${ULTRA_BLEED / 2}%`;
const EXTENT = `${100 - ULTRA_BLEED}%`;

/**
 * The button's PLATE, painted at Ultra headroom and masked to its own shape.
 *
 * This is the first of a button's two Ultra passes; UltraText is the second, on
 * the label. They are deliberately not one pass: masking a single fill to the
 * whole button would draw the label into the canvas, and a canvas cannot be
 * selected, copied, or read out. Two passes keeps the plate a picture and the
 * label a text node.
 *
 * Nothing here is measured at runtime. A rounded rectangle is a shape the mask
 * can state in percentages of its own viewport, so unlike the glyph mask there
 * are no line boxes to read back and no resize to follow.
 *
 * Decorative and inert: aria-hidden, pointer-events: none, and it never becomes
 * the thing that receives the click meant for the button it sits inside.
 */
export function UltraSurface({ radius, colour }: UltraSurfaceProps) {
  // React ids contain colons, which are invalid inside url(#...).
  const maskId = `ultra-surface-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mask = `url(#${maskId})`;

  return (
    <>
      <svg aria-hidden className="ultra__mask">
        <defs>
          <mask id={maskId}>
            {/* White, because a <mask> reads luminance: the plate is what lets
                the fill through and the ground around it is what stops it. */}
            <rect
              fill="#fff"
              height={EXTENT}
              rx={radius}
              width={EXTENT}
              x={INSET}
              y={INSET}
            />
          </mask>
        </defs>
      </svg>

      <UltraFillCanvas
        className="ultra__fill"
        colour={colour}
        style={{ mask, WebkitMask: mask }}
      />
    </>
  );
}
