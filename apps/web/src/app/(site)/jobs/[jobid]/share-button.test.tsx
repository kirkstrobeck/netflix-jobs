import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareButton } from "@/app/(site)/jobs/[jobid]/share-button";
import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { jobShare } from "@/lib/jobs/job-share";

const SHARE = jobShare(SAMPLE_JOB);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * The chain itself -- what happens when the sheet resolves, aborts or is not
 * there at all -- is decided by the browser, so it is measured in one:
 * tools/probe/share.mjs runs all five cases in Chromium. What is pinned here is
 * the part a browser cannot tell us, which is what SHIPS: the markup that is
 * sent before any of that is known.
 */
describe("the control that ships", () => {
  it("is a real link to the canonical url, with no JavaScript at all", () => {
    const html = renderToStaticMarkup(<ShareButton share={SHARE} />);

    // Server-rendered: right-clickable, copyable, openable in a new tab, and
    // identical to the first client render, so there is nothing to hydrate
    // into and no branch that renders nothing.
    expect(html).toContain(`href="${SAMPLE_JOB.canonical_url}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">Share<");
  });

  it("names the role it shares, for anyone who cannot see which page this is", () => {
    render(<ShareButton share={SHARE} />);

    expect(
      screen.getByRole("link", { name: `Share: ${SAMPLE_JOB.title}` }),
    ).toBeTruthy();
  });

  // The slot is in the DOM from first paint and holds its space, so confirming
  // a copy cannot move the control that was just pressed.
  it("keeps the confirmation's place before there is anything to confirm", () => {
    render(<ShareButton share={SHARE} />);

    const note = document.querySelector(".share-note");

    expect(note?.textContent).toBe("Link copied");
    expect(note?.className).not.toContain("share-note--on");
    expect(document.querySelector('[role="status"]')).toBeTruthy();
  });
});

describe("when the sheet opens and the visitor uses it", () => {
  /**
   * The sheet IS the confirmation -- the visitor watched their own operating
   * system hand the link to Messages. Copying on top of that would put
   * something on their clipboard they never asked for, and a "Link copied"
   * note would describe a thing that did not happen.
   */
  it("copies nothing and says nothing, because the sheet already said it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    render(<ShareButton share={SHARE} />);
    fireEvent.click(screen.getByRole("link"));

    await waitFor(() => expect(share).toHaveBeenCalledWith(SHARE));
    expect(writeText).not.toHaveBeenCalled();
    expect(document.querySelector(".share-note--on")).toBeNull();
  });
});

describe("when there is no share sheet", () => {
  it("copies the canonical url and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<ShareButton share={SHARE} />);
    fireEvent.click(screen.getByRole("link"));

    await waitFor(() =>
      expect(document.querySelector(".share-note--on")).toBeTruthy(),
    );
    expect(writeText).toHaveBeenCalledWith(SAMPLE_JOB.canonical_url);
  });

  // The note takes itself away. Left up, it stops being a confirmation of the
  // press that just happened and becomes furniture beside the button.
  it("takes the confirmation away again without being asked", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<ShareButton share={SHARE} />);
    fireEvent.click(screen.getByRole("link"));
    await act(async () => {});

    expect(document.querySelector(".share-note--on")).toBeTruthy();

    act(() => vi.advanceTimersByTime(2600));

    expect(document.querySelector(".share-note--on")).toBeNull();
    // The slot stays, so nothing moves when the note goes.
    expect(document.querySelector(".share-note")).toBeTruthy();
  });

  /**
   * The last rung. With neither API the handler must not call preventDefault,
   * because the anchor's own navigation IS the fallback -- a click that is
   * cancelled and then does nothing is the dead button this control exists to
   * avoid.
   */
  it("lets the link be a link when nothing else is available", () => {
    vi.stubGlobal("navigator", {});

    render(<ShareButton share={SHARE} />);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });

    screen.getByRole("link").dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
  });
});

describe("when the sheet is dismissed", () => {
  /**
   * AbortError is a person changing their mind. It must not be reported, and it
   * must not fall through to copying something they did not ask to copy.
   */
  it("says nothing and copies nothing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("cancelled"), { name: "AbortError" }));

    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    render(<ShareButton share={SHARE} />);
    fireEvent.click(screen.getByRole("link"));

    await waitFor(() => expect(share).toHaveBeenCalledWith(SHARE));
    expect(writeText).not.toHaveBeenCalled();
    expect(document.querySelector(".share-note--on")).toBeNull();
  });

  // Any OTHER rejection is a real failure, and the clipboard is the next rung.
  it("falls through to the clipboard when the sheet actually fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockRejectedValue(new TypeError("not allowed here"));

    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    render(<ShareButton share={SHARE} />);
    fireEvent.click(screen.getByRole("link"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(SAMPLE_JOB.canonical_url),
    );
  });
});
