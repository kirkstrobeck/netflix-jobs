// Ultra mode - https://UltraDarkMode.com

"use client";

import { useId, useRef, useState, type ElementType } from "react";

import { UltraFillCanvas } from "@/app/_ultra/ultra-fill-canvas";
import { useGlyphLines } from "@/app/_ultra/use-glyph-lines";

type UltraTextProps = {
  /** The element this replaces: h1 for a headline, span for a button label. */
  as?: ElementType;
  /** The text's own type class -- .masthead__title, .job-title, a label. */
  className: string;
  children: string;
};

/**
 * A run of text painted by an Ultra-white canvas masked to its letterforms: the
 * two page headlines, and the label on each of the two buttons in the hero.
 *
 * The canvas is decoration. The real text sits in flow -- not opacity, not
 * visibility, not a screen-reader-only clone -- so it is what defines the box,
 * what the visitor selects and copies, and what a screen reader announces. It
 * gives up its ink only once the fill is actually painting and the mask actually
 * has the words in it, which is what `data-ultra="on"` says. Anything short of
 * that -- no WebGPU, no adapter, nothing measured yet, JavaScript off -- leaves
 * ordinary white text rather than an invisible heading or a blank button.
 *
 * THIS IS WHY A BUTTON TAKES TWO PASSES RATHER THAN ONE.
 *
 * A single Ultra pass over a whole button would mask the fill to the button's
 * shape and swallow the label into the canvas -- and a canvas is a picture. The
 * label would stop being selectable, stop being copyable, and stop being what
 * assistive technology reads, because there would be no text node left carrying
 * it. So the surface gets its own pass (UltraSurface, masked to the plate) and
 * the label gets this one (masked to the glyphs), and the label stays a real
 * transparent-inked node sitting on its own fill.
 *
 * The mask is SVG <text>, one per line, positioned from the real text's own line
 * boxes; see glyph-lines.ts for why it is not a <foreignObject>. The <text>
 * elements are children of this element and state no typography, so they inherit
 * the same family, size, weight, tracking and casing as the words they cover.
 */
export function UltraText({
  as: Tag = "span" as ElementType,
  className,
  children,
}: UltraTextProps) {
  // React ids contain colons, which are invalid inside url(#...).
  const maskId = `ultra-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mask = `url(#${maskId})`;
  // THE MASK SVG IS THE ORIGIN, NOT THE HEADING.
  //
  // The <text> coordinates are absolute pixels in the SVG's own user space, and
  // ultra.css grows that SVG --ultra-bleed past the heading on every side, so
  // its top-left is no longer the heading's. Measuring against the SVG makes the
  // bleed free: grow it, shrink it, change the number, and the glyph positions
  // follow with no arithmetic anywhere. Measuring against the heading instead
  // would slide every line up and left by half the box.
  const host = useRef<SVGSVGElement>(null);
  const ink = useRef<HTMLSpanElement>(null);
  const [painting, setPainting] = useState(false);
  const lines = useGlyphLines(ink, host, children);
  const lit = painting && lines.length > 0;

  return (
    <Tag className={`ultra ${className}`} data-ultra={lit ? "on" : undefined}>
      <span className="ultra__ink" ref={ink}>
        {children}
      </span>

      {/* Full size and not hidden: display: none drops the mask entirely and a
          zero-size box clips it. It paints nothing anyway -- a <mask> inside
          <defs> is a definition, not a drawing -- and ultra.css takes it out of
          the selection so copying the headline does not yield the word twice. */}
      <svg aria-hidden className="ultra__mask" ref={host}>
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
    </Tag>
  );
}
