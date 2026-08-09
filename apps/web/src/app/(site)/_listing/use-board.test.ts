import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBoard } from "@/app/(site)/_listing/use-board";
import { board, summary } from "@/lib/jobs/job-summary.fixture";

const ROWS = board([summary({ title: "Staff engineer" })]);

function respond(body: unknown, ok = true) {
  const fetchMock = vi.fn(async (url: string) => ({
    url,
    ok,
    status: ok ? 200 : 503,
    json: async () => body,
  }));

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("useBoard", () => {
  it("is null before the board arrives", () => {
    respond(ROWS);

    expect(renderHook(() => useBoard("v1")).result.current).toBeNull();
  });

  it("hands over the rows once it has them", async () => {
    respond(ROWS);

    const { result } = renderHook(() => useBoard("v1"));

    await waitFor(() => expect(result.current).toEqual(ROWS));
  });

  // The version is the browser's cache key. Without it a flushed board would sit
  // in the browser under a year-long immutable policy until the tab was closed.
  it("asks for the version it was given", async () => {
    const fetchMock = respond(ROWS);

    renderHook(() => useBoard("bo4rdv3rs10n"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/board?v=bo4rdv3rs10n");
  });

  // Every failure below has the same answer -- stay null, which the caller reads
  // as "keep using the server". There is nothing to tell the visitor: the page
  // still works, it just costs a round trip, exactly as it did before.
  it("stays null when the request fails", async () => {
    respond(ROWS, false);

    const { result } = renderHook(() => useBoard("v1"));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("stays null when the response is not a board", async () => {
    respond({ error: "captive portal" });

    const { result } = renderHook(() => useBoard("v1"));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  // The old payload WAS the job array, so a browser holding a stale copy of it
  // -- or a proxy replaying one -- would otherwise be handed to lib/search as a
  // board with no sites, and every country facet would silently come back empty.
  it("stays null for a bare array, which is the old payload", async () => {
    respond([summary()]);

    const { result } = renderHook(() => useBoard("v1"));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  // `typeof null` is "object", so null has to be ruled out by name or it walks
  // straight through the shape check and throws on the first property read.
  it("stays null for a literal null body", async () => {
    respond(null);

    const { result } = renderHook(() => useBoard("v1"));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("stays null when the network throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const { result } = renderHook(() => useBoard("v1"));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("abandons the request when it is unmounted", async () => {
    const abort = vi.fn();
    vi.stubGlobal(
      "AbortController",
      class {
        signal = {};
        abort = abort;
      },
    );
    respond(ROWS);

    renderHook(() => useBoard("v1")).unmount();

    expect(abort).toHaveBeenCalled();
  });
});
