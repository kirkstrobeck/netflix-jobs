// Ultra mode - https://UltraDarkMode.com

"use client";

import { useId, useRef, useState } from "react";

import { UltraFillCanvas } from "@/app/_ultra/ultra-fill-canvas";
import { useGlyphLines } from "@/app/_ultra/use-glyph-lines";

type UltraHeadlineProps = {
  /** The headline's own type class: .masthead__title or .job-title. */
  className: string;
  children: string;
};

/**
 * The page's h1, painted by an Ultra-white canvas masked to its letterforms.
 *
 * The canvas is decoration. The real text sits in flow -- not opacity, not
 * visibility, not a screen-reader-only clone -- so it is what defines the box,
 * what the visitor selects and copies, and what a screen reader announces. It
 * gives up its ink only once the fill is actually painting and the mask actually
 * has the words in it, which is what `data-ultra="on"` says. Anything short of
 * that -- no WebGPU, no adapter, nothing measured yet, JavaScript off -- leaves
 * an ordinary white headline rather than an invisible one.
 *
 * The mask is SVG <text>, one per line, positioned from the real text's own line
 * boxes; see glyph-lines.ts for why it is not a <foreignObject>. The <text>
 * elements are children of this h1 and state no typography, so they inherit the
 * same family, size, weight, tracking and casing as the words they cover.
 */
export function UltraHeadline({ className, children }: UltraHeadlineProps) {
  // React ids contain colons, which are invalid inside url(#...).
  const maskId = `ultra-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mask = `url(#${maskId})`;
  const host = useRef<HTMLHeadingElement>(null);
  const ink = useRef<HTMLSpanElement>(null);
  const [painting, setPainting] = useState(false);
  const lines = useGlyphLines(ink, host, children);
  const lit = painting && lines.length > 0;

  return (
    <h1
      className={`ultra ${className}`}
      data-ultra={lit ? "on" : undefined}
      ref={host}
    >
      <span className="ultra__ink" ref={ink}>
        {children}
      </span>

      {/* Full size and not hidden: display: none drops the mask entirely and a
          zero-size box clips it. It paints nothing anyway -- a <mask> inside
          <defs> is a definition, not a drawing -- and ultra.css takes it out of
          the selection so copying the headline does not yield the word twice. */}
      <svg aria-hidden className="ultra__mask">
        <defs>
          <mask id={maskId}>
            {lines.map((line) => (
              // White, because a <mask> reads luminance: the glyphs are what
              // lets the fill through and the empty ground is what stops it.
              <text fill="#fff" key={line.y + line.text} x={line.x} y={line.y}>
                {line.text}
              </text>
            ))}
          </mask>
        </defs>
      </svg>

      <UltraFillCanvas
        className="ultra__fill"
        onPainting={setPainting}
        style={{ mask, WebkitMask: mask }}
      />
    </h1>
  );
}
