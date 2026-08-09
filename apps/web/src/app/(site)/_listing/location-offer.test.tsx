import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationOffer } from "@/app/(site)/_listing/location-offer";
import type { Nearest } from "@/app/(site)/_listing/use-nearest";

afterEach(cleanup);

const nearest = (over: Partial<Nearest> = {}): Nearest => ({
  status: "idle",
  buckets: null,
  accuracyM: null,
  place: null,
  permission: "prompt",
  request: vi.fn(),
  ...over,
});

const show = (over: Partial<Nearest> = {}) =>
  render(<LocationOffer nearest={nearest(over)} />);

const offerButton = () => screen.queryByRole("button", { name: "Use my location" });

describe("the offer to sharpen the order", () => {
  it("is a real button while the browser might still prompt", () => {
    show({ status: "idle", permission: "prompt" });

    expect(offerButton()).toBeTruthy();
  });

  // A denied permission cannot be re-prompted from script: getCurrentPosition
  // fails with PERMISSION_DENIED immediately and forever. Measured in Chromium
  // against this app -- three consecutive calls, code 1, under a millisecond
  // each, no dialog. So a button here would be a button that does nothing.
  it("offers no dead button when the permission is blocked", () => {
    show({ status: "failed", permission: "denied" });

    expect(offerButton()).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("address bar");
  });

  // The way back is browser UI, and PermissionStatus reports that change in the
  // open page with no reload -- verified in Chromium. So the button returns by
  // itself the moment they act on the instructions.
  it("comes back the moment the permission stops being blocked", () => {
    const { rerender } = show({ status: "failed", permission: "denied" });

    expect(offerButton()).toBeNull();

    rerender(<LocationOffer nearest={nearest({ status: "failed", permission: "prompt" })} />);

    expect(offerButton()).toBeTruthy();
  });

  // Not while a fix is being fetched, and not once a good one has arrived:
  // an offer to improve something that is already precise is noise.
  it("stays out of the way while locating, and once a precise fix lands", () => {
    show({ status: "locating" });
    expect(offerButton()).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Finding your location");

    cleanup();

    show({ status: "ready", buckets: {}, accuracyM: 30 });
    expect(offerButton()).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the accuracy disclosure", () => {
  // Never present a guessed position as a known one. 42km straddles the 50km
  // ring the sort buckets at, so the order it produced is not reliable.
  it("says how far out a coarse fix could be, in plain language", () => {
    show({ status: "ready", buckets: {}, accuracyM: 42_000 });

    const note = screen.getByRole("status").textContent ?? "";

    expect(note).toContain("40 km out");
    expect(note).toContain("neighbouring city");
  });

  it("says nothing at all about an accurate one", () => {
    show({ status: "ready", buckets: {}, accuracyM: 1_200 });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
