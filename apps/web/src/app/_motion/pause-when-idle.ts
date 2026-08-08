import { useCallback } from "react";

/**
 * The class the effects' stylesheets key their paused rules off. Exported so
 * the CSS generators and the tests name it once rather than three times.
 */
export const PAUSED_CLASS = "is-idle";

/**
 * Toggles PAUSED_CLASS on an element whenever it is off-screen OR its tab is in
 * the background. The stylesheets do the rest with animation-play-state, so a
 * pause costs one class mutation -- the keyframes are never rebuilt, and a
 * resumed animation carries on from where it stopped rather than restarting.
 *
 * A callback ref, not useEffect + a ref object: React 19 runs the returned
 * cleanup when the node detaches, so the observer and the listener are torn down
 * with the element itself.
 */
export function usePauseWhenIdle<T extends HTMLElement>() {
  return useCallback((node: T | null) => {
    // React detaches by calling the returned cleanup, not by passing null --
    // but the ref type still allows null for the legacy callback-ref contract,
    // so there is nothing to set up on that call.
    if (!node) {
      return undefined;
    }

    let onScreen = false;

    const sync = () => {
      node.classList.toggle(PAUSED_CLASS, !onScreen || document.hidden);
    };

    // Default threshold: any pixel of overlap counts as on-screen, which is what
    // a full-bleed backdrop wants -- it should be running before its first row
    // of pixels is read, not once some fraction of it is showing.
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      sync();
    });

    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    // Starts paused: the observer fires on its own almost immediately, and this
    // way an element mounted off-screen never gets a frame of animation first.
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
}
