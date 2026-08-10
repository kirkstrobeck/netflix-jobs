import { afterEach, describe, expect, it, vi } from "vitest";

import { geocodeCity, geocoderConfigured, placeName } from "@/lib/geo/geocoder";

const FIX = { lat: 45.49, lng: -122.8 };

afterEach(() => vi.unstubAllEnvs());

describe("whether there is a geocoder at all", () => {
  it("says no when no deployment names a provider, which is every deployment today", () => {
    vi.stubEnv("NEXT_PUBLIC_GEOCODER", undefined);

    expect(geocoderConfigured()).toBe(false);
  });

  // What a deployment variable holds when it has been declared and never given
  // a value. Reading that as "yes" would turn the feature on with nothing
  // behind it.
  it.each(["", "   "])("says no when the name is set to %o", (value) => {
    vi.stubEnv("NEXT_PUBLIC_GEOCODER", value);

    expect(geocoderConfigured()).toBe(false);
  });

  it("says yes once a provider is named", () => {
    vi.stubEnv("NEXT_PUBLIC_GEOCODER", "some-provider");

    expect(geocoderConfigured()).toBe(true);
  });
});

/**
 * With nothing configured, both directions answer null and the callers render
 * the feature away. Null is the honest answer here BECAUSE it is unconfigured:
 * the heading falls back to "nearest to you" and the typed-city offer is not
 * shown at all.
 */
describe("with no geocoder configured", () => {
  it("cannot name a position, and does not invent one", async () => {
    vi.stubEnv("NEXT_PUBLIC_GEOCODER", undefined);

    await expect(placeName(FIX)).resolves.toBeNull();
  });

  it("cannot place a typed city, and does not guess at a centroid", async () => {
    vi.stubEnv("NEXT_PUBLIC_GEOCODER", undefined);

    await expect(geocodeCity("Beaverton")).resolves.toBeNull();
  });
});

/**
 * The flag on with no implementation behind it is a configuration mistake, and
 * the loud failure is the point.
 *
 * Returning null here instead would be indistinguishable from "we asked a real
 * geocoder and it did not recognise that place" -- so a deployment that named a
 * provider and got no implementation would look like a working geocoder that
 * recognises nowhere, on every position and every city, forever. That is the
 * failure nobody ever reports, so it throws instead.
 */
describe("with a provider named but nothing implemented", () => {
  it("refuses to reverse geocode, and names the position it could not name", async () => {
    vi.stubEnv("NEXT_PUBLIC_GEOCODER", "some-provider");

    await expect(placeName(FIX)).rejects.toThrow("45.49,-122.8");
  });

  it("refuses to forward geocode, and names the city it could not place", async () => {
    vi.stubEnv("NEXT_PUBLIC_GEOCODER", "some-provider");

    await expect(geocodeCity("Beaverton")).rejects.toThrow("Beaverton");
  });
});
