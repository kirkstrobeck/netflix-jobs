import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWhere } from "@/app/(site)/_listing/use-where";

afterEach(() => vi.unstubAllGlobals());

function respond(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }));

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("useWhere", () => {
  // The server renders no place and so does the first client render. If this
  // ever started with a value the shell could not be static.
  it("starts null, so the server's HTML and the first render agree", () => {
    respond({ country: "us" });

    expect(renderHook(() => useWhere(true)).result.current).toBeNull();
  });

  it("hands back the country the edge saw, upper-cased", async () => {
    const fetchMock = respond({ country: "us" });

    const { result } = renderHook(() => useWhere(true));

    await waitFor(() => expect(result.current).toBe("US"));
    expect(fetchMock).toHaveBeenCalledWith("/api/where");
  });

  // Newest, or a URL that already names a country: there is nothing the answer
  // could change, so asking would be a request spent on nothing.
  it("does not ask when the answer could not change anything", () => {
    const fetchMock = respond({ country: "us" });

    renderHook(() => useWhere(false));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Nearest -> Newest -> Nearest is one request, not three. The answer cannot
  // have changed in between, and the ref is what says so.
  it("asks once per page however many times the sort is switched", async () => {
    const fetchMock = respond({ country: "us" });

    const { rerender, result } = renderHook(({ on }) => useWhere(on), {
      initialProps: { on: true },
    });

    await waitFor(() => expect(result.current).toBe("US"));

    rerender({ on: false });
    rerender({ on: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Every failure is the same failure: the heading says nothing rather than
  // something wrong. A code that is not a code is the dangerous one -- it would
  // filter the board to nothing and read as an empty board.
  it.each([
    ["a 500", { country: "us" }, false],
    ["a body with no country", {}, true],
    ["a country that is not a string", { country: 12 }, true],
    ["a three-letter code", { country: "USA" }, true],
    ["the empty string the edge sets when it cannot place the address", { country: "" }, true],
  ])("stays null on %s", async (_case, body, ok) => {
    respond(body, ok);

    const { result } = renderHook(() => useWhere(true));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("stays null, and does not reject, when the request never lands", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const { result } = renderHook(() => useWhere(true));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  // A route change while the request is in flight. Setting state into an
  // unmounted hook is the React warning this guard exists to avoid.
  it("does not set state when the answer lands after unmount", async () => {
    let land = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            land = () => resolve({ ok: true, json: async () => ({ country: "us" }) });
          }),
      ),
    );

    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useWhere(true));

    unmount();
    land();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(result.current).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
