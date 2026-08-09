"use client";

import type { NearestStatus } from "@/app/(site)/_listing/use-nearest";

/**
 * What Nearest is actually doing, in words, whenever that is not "sorting by
 * distance".
 *
 * The rule this enforces: the list on screen and the control above it never
 * disagree. Every path that does not end in rings ends with the newest list --
 * that is orderResults' fallback -- so every one of those paths has a sentence
 * here saying both halves out loud: what happened, and what you are therefore
 * looking at. A control reading "Nearest" over a list that is not sorted by
 * distance, with nothing to explain it, is the failure this exists to prevent.
 *
 * "Denied" is written as a fact about a setting rather than as a scolding.
 * Blocking location is a reasonable thing to have done and the sentence should
 * read like the site agrees.
 */
const MESSAGES: Partial<Record<NearestStatus, string>> = {
  locating: "Finding your location…",
  denied: "Location is blocked for this site, so roles are ordered newest first.",
  unavailable:
    "Your device could not work out where it is, so roles are ordered newest first.",
  timeout: "Finding your location took too long, so roles are ordered newest first.",
  unsupported:
    "This browser cannot share a location, so roles are ordered newest first.",
  failed: "We could not work out what is near you, so roles are ordered newest first.",
  // `idle` is the shared-link case: the URL asks for Nearest, the permission
  // has not been given, and nothing has been asked for yet. It says what to do
  // rather than what went wrong, because nothing has.
  idle: "Nearest needs your location. Choose Nearest to share it.",
};

/**
 * `ready` is deliberately absent from the table above. When the sort worked,
 * the ordered list is the message -- a line saying "sorted by distance" over a
 * list that is sorted by distance is a caption, and captions on things that
 * speak for themselves are how a page fills up with noise.
 *
 * role="status" rather than aria-live on a permanent node: this element comes
 * and goes with the state, and status is the role whose contents are announced
 * politely when they appear. It is only rendered while Nearest is the chosen
 * order, so switching back to Newest removes it rather than leaving a stale
 * explanation of a sort nobody asked for any more.
 */
export function SortStatus({ status }: { status: NearestStatus }) {
  const message = MESSAGES[status];

  if (!message) {
    return null;
  }

  return (
    <p className="sort-status" role="status">
      {message}
    </p>
  );
}
