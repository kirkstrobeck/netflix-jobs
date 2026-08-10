// Ultra mode by Kirk Strobeck – https://UltraDarkMode.com

"use client";

import { useEffect, useState, type RefObject } from "react";

import { glyphLines, type GlyphLine } from "@/lib/ultra/glyph-lines";

/**
 * The headline's line boxes, re-read whenever they can have moved.
 *
 * Three triggers, and each one is a way the mask has gone stale while the words
 * have not moved on screen:
 *
 *   mount    nothing is measurable during render, and nothing is measured on
 *            the server -- the first paint is a plain SDR headline
 *   resize   the whole point: this headline rewraps, and a mask built for two
 *            lines over a headline that now has three covers half of it
 *   fonts    next/font swaps the display face in after first paint, and every
 *            glyph moves when it does
 *
 * The lines are state rather than a ref because the mask is markup: React has to
 * re-render the <text> elements, and an effect that only mutated a ref would
 * leave the mask holding the previous layout for good.
 */
export function useGlyphLines(
  ink: RefObject<HTMLElement | null>,
  host: RefObject<HTMLElement | null>,
  text: string,
): GlyphLine[] {
  const [lines, setLines] = useState<GlyphLine[]>([]);

  useEffect(() => {
    const measure = () => {
      if (!ink.current || !host.current) return;

      setLines(glyphLines(ink.current, host.current));
    };

    measure();
    window.addEventListener("resize", measure);
    // Not awaited past the unmount: a resolved promise that calls setLines on a
    // gone component is a no-op in React 19, but the listener above is not.
    void document.fonts?.ready.then(measure);

    return () => window.removeEventListener("resize", measure);
    // `text` is a dependency because the headline is a different string on every
    // posting, and the client router swaps it without remounting this component.
  }, [ink, host, text]);

  return lines;
}
