import { afterEach, describe, expect, it, vi } from "vitest";

import {
  watchLocationPermission,
  type PermissionState,
} from "@/lib/geo/locate";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * A stand-in for PermissionStatus, which jsdom does not implement.
 *
 * It is a real event target in the only way that matters here: `flip` changes
 * `state` FIRST and then notifies, because the production listener reads
 * `status.state` when it fires rather than taking a value from the event. A
 * fake that notified before mutating would pass a listener that is subtly
 * wrong.
 */
function permissionStatus(state: PermissionState) {
  const listeners = new Set<() => void>();

  const status = {
    state,
    addEventListener: vi.fn((_name: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_name: string, listener: () => void) => {
      listeners.delete(listener);
    }),
    flip(next: PermissionState) {
      status.state = next;
      listeners.forEach((listener) => listener());
    },
  };

  return status;
}

function withPermissions(query: () => Promise<unknown>) {
  vi.stubGlobal("navigator", { permissions: { query } });
}

describe("watchLocationPermission", () => {
  it("reports the state the visitor is already in", async () => {
    const status = permissionStatus("denied");
    withPermissions(async () => status);

    const seen: PermissionState[] = [];
    watchLocationPermission((state) => seen.push(state));
    await vi.waitFor(() => expect(seen).toEqual(["denied"]));
  });

  // The whole reason this function exists. Once an origin is blocked no script
  // can raise the prompt again, so the only way the offer can turn back into a
  // live button is this event -- and it has to arrive without a navigation.
  it("reports again when the visitor flips the site setting, with no reload", async () => {
    const status = permissionStatus("denied");
    withPermissions(async () => status);

    const seen: PermissionState[] = [];
    watchLocationPermission((state) => seen.push(state));
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    status.flip("granted");

    expect(seen).toEqual(["denied", "granted"]);
  });

  it("stops reporting once it is unsubscribed", async () => {
    const status = permissionStatus("prompt");
    withPermissions(async () => status);

    const seen: PermissionState[] = [];
    const stop = watchLocationPermission((state) => seen.push(state));
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    stop();
    status.flip("granted");

    expect(seen).toEqual(["prompt"]);
    expect(status.removeEventListener).toHaveBeenCalledTimes(1);
  });

  // A component that mounts and unmounts before the query settles -- a fast
  // route change. Reporting into an unmounted caller is the React warning this
  // is written to avoid, and the listener must never be attached either, or it
  // outlives the subscription that was already cancelled.
  it("says nothing when it is unsubscribed before the query settles", async () => {
    const status = permissionStatus("granted");
    let settle = () => {};
    withPermissions(
      () => new Promise((resolve) => (settle = () => resolve(status))),
    );

    const seen: PermissionState[] = [];
    const stop = watchLocationPermission((state) => seen.push(state));

    stop();
    settle();
    await vi.waitFor(() => expect(status.addEventListener).not.toHaveBeenCalled());

    status.flip("denied");

    expect(seen).toEqual([]);
  });

  // Safari shipped Permissions without a geolocation descriptor and throws on
  // the query. "We cannot tell" is not "it is blocked": callers must not offer
  // instructions for un-blocking a permission that was never denied.
  it("says unknown when the query throws", async () => {
    withPermissions(async () => {
      throw new Error("no geolocation descriptor");
    });

    const seen: PermissionState[] = [];
    watchLocationPermission((state) => seen.push(state));
    await vi.waitFor(() => expect(seen).toEqual(["unknown"]));
  });

  it("says unknown, immediately, when there is no Permissions API", () => {
    vi.stubGlobal("navigator", {});

    const seen: PermissionState[] = [];
    const stop = watchLocationPermission((state) => seen.push(state));

    expect(seen).toEqual(["unknown"]);
    expect(stop).not.toThrow();
  });

  it("says unknown when there is no navigator at all", () => {
    vi.stubGlobal("navigator", undefined);

    const seen: PermissionState[] = [];
    watchLocationPermission((state) => seen.push(state));

    expect(seen).toEqual(["unknown"]);
  });
});
