"use client";

import type { Nearest } from "@/app/(site)/_listing/use-nearest";
import { accuracyKm, isCoarse } from "@/lib/geo/accuracy";

/**
 * What replaced the five "so roles are ordered newest first" sentences.
 *
 * WHAT WENT, AND WHY IT WAS WRONG RATHER THAN BADLY WORDED
 *
 * There used to be a line under the heading for each way of not getting a
 * position -- denied, unavailable, timeout, no geolocation, endpoint failed --
 * and every one of them said the list had fallen back to newest. They all rested
 * on the same false premise: that without the browser's permission we have no
 * idea where the visitor is. We always have a country. It comes off the cookie
 * or the geo header, it is in the URL by the time anything renders, and the
 * listing is already filtered by it. Nearest never has to refuse to sort, so
 * there is never an apology to print, and `?sort=near` cannot drift out of step
 * with what the list is doing.
 *
 * What is left is the only thing those sentences should ever have been: an offer
 * to make the order BETTER, and an honest note when the position we have is
 * vague. The heading above says what the order currently is.
 *
 * THE OFFER APPEARS ONLY WHEN IT WOULD CHANGE SOMETHING
 *
 * Not while a fix is being fetched, not once a precise one has arrived, and not
 * when the permission is blocked -- there it is a dead end, and a button that
 * calls getCurrentPosition again is a button that does nothing. Measured in
 * Chromium: after a denial, three consecutive calls each failed with
 * PERMISSION_DENIED in under a millisecond and raised no dialog. So the blocked
 * case gets instructions instead, and the button comes back by itself when the
 * visitor acts on them -- PermissionStatus fires `change` in the open page, with
 * no reload, which is what the `permission` prop is watching.
 */

const blocked = (byCountry: boolean) =>
  `Location is blocked for this site, so this list is ordered ${
    byCountry ? "by country" : "newest first"
  }. To use it, allow location for this site in your browser's address bar or site settings.`;

function accuracyNote(accuracyM: number): string {
  return `This position came from the network rather than a satellite, so it could be about ${accuracyKm(accuracyM)} km out — roles in a neighbouring city may be ordered wrongly.`;
}

/**
 * "Ordered by country" was true of one case and printed for all of them.
 *
 * It is true when a country filter is applied: the list IS the roles in that
 * country. It was false for the visitor who cleared the filter -- their list is
 * every role on the board, newest first -- and telling them it was ordered by a
 * country they had just removed was the offer describing a filter that was not
 * there. The heading names the tier; this names the ORDER, and now it names the
 * one the list is actually in.
 */
const ordering = (byCountry: boolean) =>
  byCountry ? "Ordered by country." : "Ordered newest first.";

type LocationOfferProps = { nearest: Nearest; byCountry: boolean };

export function LocationOffer({ byCountry, nearest }: LocationOfferProps) {
  const { status, accuracyM, permission, request } = nearest;

  if (status === "locating") {
    return (
      <p className="location-offer" role="status">
        Finding your location…
      </p>
    );
  }

  // A position arrived. The only thing left worth saying is whether it is wide
  // enough to have put the visitor in the wrong metro ring -- and if it is not,
  // nothing is said at all, because a disclaimer on an accurate fix is noise
  // that teaches people to ignore the one that matters.
  if (status === "ready") {
    if (!isCoarse(accuracyM)) {
      return null;
    }

    return (
      <p className="location-offer location-offer--warn" role="status">
        {accuracyNote(accuracyM!)}
      </p>
    );
  }

  // Blocked. No button, because there is no call that could succeed; the way
  // back is browser UI, so that is what the sentence describes. When they take
  // it, `permission` changes under us and the offer below replaces this.
  if (permission === "denied") {
    return (
      <p className="location-offer location-offer--warn" role="status">
        {blocked(byCountry)}
      </p>
    );
  }

  // The offer itself. A button rather than a link: it asks the browser for a
  // position, which is not an address anyone can navigate to.
  return (
    <p className="location-offer">
      {ordering(byCountry)}{" "}
      <button className="location-offer__action" onClick={request} type="button">
        Use my location
      </button>{" "}
      for a more accurate order.
    </p>
  );
}
