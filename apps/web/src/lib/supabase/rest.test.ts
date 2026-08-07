import { afterEach, describe, expect, it, vi } from "vitest";

import { restGet } from "@/lib/supabase/rest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("restGet", () => {
  it("returns parsed json on success", async () => {
    const json = vi.fn().mockResolvedValue({ ok: true });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal("fetch", fetchMock);

    await expect(restGet("jobs?select=*")).resolves.toEqual({ ok: true });
  });

  it("sends the apikey, bearer, and accept headers", async () => {
    const json = vi.fn().mockResolvedValue([]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal("fetch", fetchMock);

    await restGet("jobs?select=*");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/rest/v1/jobs?select=*"),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: expect.any(String),
          Authorization: expect.stringMatching(/^Bearer /),
          Accept: "application/json",
        }),
      }),
    );
  });

  it("throws with status and body when the response is not ok", async () => {
    const text = vi.fn().mockResolvedValue("boom");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text });
    vi.stubGlobal("fetch", fetchMock);

    await expect(restGet("jobs?select=*")).rejects.toThrow(
      "GET jobs?select=* -> 500: boom",
    );
  });
});
