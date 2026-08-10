"use client";

import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";

import { UltraSurface } from "@/app/_ultra/ultra-surface";
import { UltraText } from "@/app/_ultra/ultra-text";
import { CTA_RADIUS, ULTRA_SURFACE } from "@/app/(site)/jobs/[jobid]/cta-ultra";
import type { JobShare } from "@/lib/jobs/job-share";

/**
 * The share control: an anchor first, a script second.
 *
 * WHY THIS IS ONE OF THE FEW PLACES JAVASCRIPT IS UNAVOIDABLE
 *
 * navigator.share() is the operating system's own sheet -- the one with
 * Messages, AirDrop and every installed app in it -- and there is no markup
 * that opens it. It also only exists in a user gesture, so it cannot be
 * prefetched, warmed or wrapped in anything declarative.
 *
 * What IS declarative is everything around it. The element that ships is a real
 * link to the canonical URL: it is in the HTML with no JavaScript, it can be
 * right-clicked and copied, it can be opened in a new tab, and it is a link
 * because what it points at is an address. The handler below only ever
 * INTERCEPTS that link when it has something better to offer.
 *
 * THE CHAIN, AND WHY NO RUNG OF IT RENDERS NOTHING
 *
 *   1. navigator.share       Safari/iOS, Android Chrome, and desktop Chrome on
 *                            Windows and macOS. Not desktop Firefox, not Linux.
 *   2. navigator.clipboard   everywhere else that is a secure context. The URL
 *                            goes to the clipboard and the copy is confirmed in
 *                            place.
 *   3. the link itself       neither API, or both failed: preventDefault is
 *                            never called and the browser follows the href.
 *
 * Feature detection happens in the handler rather than in render, which is what
 * keeps the server's HTML and the first client render identical. A control that
 * decided its own existence from `typeof navigator.share` would be a hydration
 * mismatch and, worse, a control that is missing on the browsers least able to
 * cope with its absence.
 *
 * AN ABORT IS NOT AN ERROR
 *
 * Dismissing the sheet rejects the promise with AbortError. That is a person
 * changing their mind, so it resolves as handled and nothing at all is said --
 * no toast, no console noise, no fallback copy they did not ask for. Any OTHER
 * rejection is a real failure and falls through to the clipboard.
 */

// Long enough to read four syllables, short enough that it is gone before it
// becomes furniture.
const NOTE_MS = 2600;

const isAbort = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

type Outcome = "shared" | "copied" | "none";

async function offer(share: JobShare): Promise<Outcome> {
  if (typeof navigator.share === "function") {
    const handled = await navigator.share(share).then(() => true, isAbort);

    if (handled) {
      return "shared";
    }
  }

  if (typeof navigator.clipboard?.writeText === "function") {
    const copied = await navigator.clipboard.writeText(share.url).then(
      () => true,
      () => false,
    );

    if (copied) {
      return "copied";
    }
  }

  return "none";
}

export function ShareButton({ share }: { share: JobShare }) {
  const [copied, setCopied] = useState(false);

  // The note takes itself away. Cleanup on the way out matters here because a
  // second copy while the first is still showing must restart the clock rather
  // than inherit the tail of it.
  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), NOTE_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // Both absent: this is a link and nothing more. Returning before
      // preventDefault is what makes that true rather than merely claimed.
      if (
        typeof navigator.share !== "function" &&
        typeof navigator.clipboard?.writeText !== "function"
      ) {
        return;
      }

      event.preventDefault();
      setCopied(false);

      void offer(share).then((outcome) => {
        if (outcome === "copied") {
          setCopied(true);
        }

        // Everything we know how to do failed. The href is still the answer, so
        // take the navigation that was just cancelled.
        if (outcome === "none") {
          window.location.assign(share.url);
        }
      });
    },
    [share],
  );

  return (
    <>
      {/* Secondary by weight and fill, not by size: it is the same height as
          Apply and clears the same 44px target, because a control that is hard
          to hit is not modest, it is broken. */}
      <a
        className="share-button ultra-plate"
        href={share.url}
        onClick={onClick}
        rel="noopener noreferrer"
        target="_blank"
      >
        {/* Two Ultra passes, as on Apply: the plate and the label are separate
            elements so the words stay a real, selectable text node rather than
            being drawn into the canvas. See apply-button.tsx. */}
        <UltraSurface colour={ULTRA_SURFACE} radius={CTA_RADIUS} />
        <UltraText className="cta__label">Share</UltraText>
        <span className="visually-hidden">: {share.title}</span>
      </a>

      {/* The live region is the stable outer span, present from first paint and
          never re-created -- a region added at the same moment as its text is
          not reliably announced. What changes inside it is the note's
          visibility, which is what takes it in and out of the accessibility
          tree and therefore what there is to announce.

          visibility rather than a mount: the space is reserved either way, so
          confirming the copy cannot move the button that was just pressed. */}
      <span className="job-cta__status" role="status">
        <span className={copied ? "share-note share-note--on" : "share-note"}>
          Link copied
        </span>
      </span>
    </>
  );
}
