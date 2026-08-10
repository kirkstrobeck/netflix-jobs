"use client";

import dynamic from "next/dynamic";

/**
 * The footer glow, off the critical path.
 *
 * Its stylesheet is 156KB of generated keyframes -- 100 orbs, two animations
 * each -- and it compresses to 118,925 bytes on the wire because every number in
 * it is unique. Imported from a server component it becomes a render-blocking
 * <link> in the document head, so a phone on a throttled connection waits for
 * all of it before painting anything. Measured on the deployed site: 163,986
 * bytes of blocking CSS, of which this file was 73%.
 *
 * Nothing on the first screen needs it. The glow is aria-hidden decoration at
 * the bottom of the page, behind the footer, and a visitor reaches it after
 * scrolling past every result. Loading it with the rest of the page buys nothing
 * and costs the largest contentful paint.
 *
 * next/dynamic with ssr: false moves both the markup and the stylesheet into a
 * chunk fetched after hydration. Next is already the framework; this adds no
 * dependency. The cost is that the band renders without its glow until that
 * chunk lands, which is the correct trade for decoration that starts below the
 * fold: the footer keeps its own red ground either way, because that is
 * .job-footer's background rather than anything in here.
 */
/** Exported so a test can resolve it; next/dynamic calls it after hydration. */
export const loadGlow = () => import("@/app/_glow/glow").then((m) => m.Glow);

const Glow = dynamic(loadGlow, { ssr: false });

export function DeferredGlow() {
  return <Glow />;
}
