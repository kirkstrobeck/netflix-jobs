/**
 * The browser's own position, asked for once, as a promise.
 *
 * This is the ONLY place navigator.geolocation is touched. It is called from a
 * click handler and from nowhere else -- never at module scope, never in an
 * effect that runs on mount -- because calling it is what raises the permission
 * prompt, and a prompt nobody asked for is the thing this whole path is
 * designed to avoid.
 */

import { coarsen, type Fix } from "@/lib/geo/fix";

/**
 * Why there is no position, in the visitor's terms rather than the spec's.
 *
 * `unsupported` is separate from `unavailable`: an old browser with no
 * geolocation at all and a device that tried and failed are different sentences
 * to write on screen.
 */
export type LocateFailure = "denied" | "unavailable" | "timeout" | "unsupported";

/**
 * The position, plus how wide it is.
 *
 * `accuracyM` is GeolocationCoordinates.accuracy verbatim: the radius in metres
 * of a 95% confidence circle around the point. It is carried because a position
 * is not a fact until you know how big it is -- a Wi-Fi or IP-derived fix can be
 * tens of kilometres wide, which is wider than the 50km ring the sort buckets
 * at, and presenting that as "you are here" is presenting a guess as knowledge.
 * The fix itself is coarsened before it leaves the browser; this number is not
 * coarsened, because it is what the disclosure is computed from and it never
 * goes to the server.
 */
export type LocateResult = { fix: Fix; accuracyM: number } | { failure: LocateFailure };

// Long enough for a cold GPS fix on a phone, short enough that the control does
// not sit saying "Finding you" past the point anyone believes it.
const TIMEOUT_MS = 10_000;

// A fix from the last five minutes is reused rather than re-acquired. The answer
// is bucketed to 50km, so a position from five minutes ago is the same answer,
// and this is the difference between an instant re-sort and a second GPS spin.
const MAX_AGE_MS = 5 * 60 * 1000;

// GeolocationPositionError codes, named. 1/2/3 in a switch is a puzzle.
const FAILURES: Record<number, LocateFailure> = {
  1: "denied",
  2: "unavailable",
  3: "timeout",
};

export function locate(): Promise<LocateResult> {
  // Not just "is this a browser". Geolocation is absent over plain HTTP in
  // every current engine, which is a real deployment, so the capability is
  // tested rather than the environment.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ failure: "unsupported" });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          fix: coarsen({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
          // Not coarsened, and not sent anywhere. It decides one thing: whether
          // the visitor is told this position may be well off.
          accuracyM: position.coords.accuracy,
        }),
      (error) => resolve({ failure: FAILURES[error.code] ?? "unavailable" }),
      {
        // false, and not as an oversight. High accuracy powers up the GPS for a
        // rooftop fix; the answer is rounded to 50km rings, so it would spend
        // battery and seconds to compute the identical result.
        enableHighAccuracy: false,
        maximumAge: MAX_AGE_MS,
        timeout: TIMEOUT_MS,
      },
    );
  });
}

/**
 * Has the visitor already granted this, on a previous visit?
 *
 * The Permissions API answers without prompting -- that is the entire reason it
 * is used here. A shared `?sort=near` link may not raise a prompt on load, so
 * the only load-time question allowed is "would this be silent?", and the
 * position is fetched only when the answer is yes. Anything else waits for a
 * click.
 *
 * Unknown answers count as no. Safari shipped Permissions without a
 * geolocation descriptor for years and throws on the query, and "we could not
 * tell" has to fall on the side that does not prompt.
 */
export async function locationGranted(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.permissions) {
    return false;
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });

    return status.state === "granted";
  } catch {
    return false;
  }
}

/**
 * What the permission is now, and every time it changes -- without a reload.
 *
 * THIS IS THE HALF THAT MAKES RETRY POSSIBLE AT ALL
 *
 * Once an origin is blocked, getCurrentPosition fails with PERMISSION_DENIED
 * immediately and forever, and no script can raise the prompt again. Measured in
 * Chromium against this app: three consecutive calls after a denial returned
 * code 1 in 0-1ms each, with no dialog. So a "Retry" button that just calls it
 * again is a button that does nothing, and the honest UI has to say how to
 * re-enable it in browser UI instead.
 *
 * What browser UI does give us is this event. PermissionStatus fires `change`
 * the moment the visitor flips the site setting, in the page they already have
 * open -- verified in the same run, which observed 'denied' then 'granted'
 * without a navigation. So the offer can go from "here is how to turn it on" to
 * a live button the instant they do it, and nobody is told to reload.
 *
 * Returns an unsubscribe. `unknown` is Safari, which shipped Permissions without
 * a geolocation descriptor and throws on the query: it means "we cannot tell",
 * and every caller has to treat it as "do not claim it is blocked".
 */
export type PermissionState = "granted" | "denied" | "prompt" | "unknown";

export function watchLocationPermission(
  onChange: (state: PermissionState) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.permissions) {
    onChange("unknown");
    return () => {};
  }

  let live = true;
  let detach = () => {};

  navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (!live) {
        return;
      }

      const report = () => onChange(status.state as PermissionState);

      report();
      status.addEventListener("change", report);
      detach = () => status.removeEventListener("change", report);
    })
    .catch(() => onChange("unknown"));

  return () => {
    live = false;
    detach();
  };
}
