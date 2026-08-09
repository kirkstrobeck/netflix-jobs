import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { restRpc } from "@/lib/supabase/rpc";

// Stubbed rather than inherited: lib/supabase/env.ts throws when either is
// unset, so the URL asserted below is one this test states, not one that leaked
// in from a default.
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54721");
  vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("restRpc", () => {
  it("returns parsed json on success", async () => {
    const json = vi.fn().mockResolvedValue([{ slug: "us-los-gatos" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json }));

    await expect(restRpc("sites_by_distance", { lat: 1, lng: 2 })).resolves.toEqual([
      { slug: "us-los-gatos" },
    ]);
  });

  // POST with the arguments in the BODY. A coordinate in a query string ends up
  // in access logs, proxy caches and Referer headers; this is what keeps it out.
  it("posts the arguments as a json body, not as a query string", async () => {
    const json = vi.fn().mockResolvedValue([]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal("fetch", fetchMock);

    await restRpc("sites_by_distance", { lat: 37.23, lng: -121.96 });

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe(
      "http://127.0.0.1:54721/rest/v1/rpc/sites_by_distance",
    );
    expect(url).not.toContain("37.23");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ lat: 37.23, lng: -121.96 }),
      headers: expect.objectContaining({
        apikey: expect.any(String),
        Authorization: expect.stringMatching(/^Bearer /),
        "Content-Type": "application/json",
      }),
    });
  });

  it("throws with status and body when the call fails", async () => {
    const text = vi.fn().mockResolvedValue("no such function");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text }),
    );

    await expect(restRpc("nope", {})).rejects.toThrow(
      "RPC nope -> 404: no such function",
    );
  });
});
