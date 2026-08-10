import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareButton } from "@/app/(site)/jobs/[jobid]/share-button";
import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { jobShare } from "@/lib/jobs/job-share";

/**
 * The bottom of the chain: a press that has already been intercepted and then
 * finds nothing left that works.
 *
 * This is the case the handler cannot rule out before it commits. It decides
 * whether to call preventDefault from what the browser CLAIMS to support, and a
 * clipboard that exists can still refuse -- a denied permission, a gesture
 * already spent, an insecure context. By the time the refusal arrives the
 * navigation has been cancelled, so it has to be taken by hand or the press
 * does nothing at all, which is the dead button this control exists to avoid.
 */

const SHARE = jobShare(SAMPLE_JOB);

// jsdom will not navigate, and window.location's methods are non-configurable,
// so they cannot be spied. Replacing the whole property and putting it back is
// the only way to watch for the navigation.
const REAL_LOCATION = Object.getOwnPropertyDescriptor(window, "location")!;

function watchNavigation() {
  const assign = vi.fn();

  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign },
  });

  return assign;
}

const refuses = () => vi.fn().mockRejectedValue(new Error("write permission denied"));
const fails = () => vi.fn().mockRejectedValue(new TypeError("not allowed here"));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", REAL_LOCATION);
});

describe("when the clipboard is there and says no", () => {
  it("takes the navigation it cancelled, rather than leaving a dead button", async () => {
    const assign = watchNavigation();

    vi.stubGlobal("navigator", { clipboard: { writeText: refuses() } });

    render(<ShareButton share={SHARE} />);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("link").dispatchEvent(click);

    await waitFor(() => expect(assign).toHaveBeenCalledWith(SAMPLE_JOB.canonical_url));

    // Cancelled on the way in, and honoured on the way out. Both halves have to
    // be true for the press to end up where the link pointed.
    expect(click.defaultPrevented).toBe(true);
  });

  // Nothing was copied, so nothing may claim it was. The note is the only thing
  // on screen that could, and a false confirmation is worse than none.
  it("does not say a link was copied when no link was copied", async () => {
    const assign = watchNavigation();

    vi.stubGlobal("navigator", {
      share: fails(),
      clipboard: { writeText: refuses() },
    });

    render(<ShareButton share={SHARE} />);
    fireEvent.click(screen.getByRole("link"));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(SAMPLE_JOB.canonical_url));
    expect(document.querySelector(".share-note--on")).toBeNull();
  });
});

// A sheet with no clipboard behind it. The handler intercepted the click on the
// strength of navigator.share alone, so when the sheet fails for real there is
// no second rung to fall to and the href is all that is left.
describe("when the sheet fails and there is no clipboard at all", () => {
  it("still ends up at the address the link pointed to", async () => {
    const share = fails();
    const assign = watchNavigation();

    vi.stubGlobal("navigator", { share });

    render(<ShareButton share={SHARE} />);
    fireEvent.click(screen.getByRole("link"));

    await waitFor(() => expect(share).toHaveBeenCalledWith(SHARE));
    expect(assign).toHaveBeenCalledWith(SAMPLE_JOB.canonical_url);
  });
});
