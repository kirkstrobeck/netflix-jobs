"use client";

import type { ReactNode } from "react";

import { usePauseWhenIdle } from "@/app/_motion/pause-when-idle";

// The entire client boundary for both decorative effects: a root element that
// knows when it is idle. Bars and Glow stay server components and hand their
// markup in as `children`, so the generated <style> and the several hundred
// animated divs are still server-rendered -- only this wrapper ships JS.
//
// Both effects' roots are decorative, so aria-hidden is baked in rather than
// left to each caller to remember.
export function MotionRegion({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <div aria-hidden="true" className={className} ref={usePauseWhenIdle()}>
      {children}
    </div>
  );
}
