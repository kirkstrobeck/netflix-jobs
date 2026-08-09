import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Listing } from "@/app/(site)/_listing/listing";
import { summary } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

// A stand-in for the pairing this whole feature rests on: Next patches
// history.pushState so that useSearchParams holds the pushed URL, and restores
// the same way on popstate. The stack below is a real one -- push truncates the
// forward entries, back walks the cursor -- so "the URL fully restores state"
// is tested against something that can actually get it wrong.
const listeners = new Set<() => void>();
let stack = ["/"];
let cursor = 0;

const url = () => stack[cursor];
const announce = () => listeners.forEach((notify) => notify());

const push = vi.fn();
const pushState = vi.fn((_state: unknown, _title: string, next: string) => {
  stack = [...stack.slice(0, cursor + 1), next];
  cursor += 1;
  announce();
});

const travel = async (step: number) => {
  await act(async () => {
    cursor += step;
    announce();
  });
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () =>
    new URLSearchParams(
      useSyncExternalStore(
        (notify: () => void) => {
          listeners.add(notify);
          return () => listeners.delete(notify);
        },
        () => url().split("?")[1] ?? "",
        () => "",
      ),
    ),
}));

// 25 roles over two teams: three pages, and a facet worth counting.
const BOARD = Array.from({ length: 25 }, (_, i) =>
  summary({
    title: `Role ${i}`,
    team: i < 10 ? "Engineering" : "Marketing",
    work_type: i % 2 === 0 ? "Onsite" : "Remote",
  }),
);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stack = ["/"];
  cursor = 0;
  push.mockClear();
  pushState.mockClear();
  vi.stubGlobal("fetch", (fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => BOARD,
  }))));
  vi.stubGlobal("history", { pushState });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(query: JobQuery = EMPTY_QUERY) {
  return render(
    <Listing
      boardVersion="v1"
      initialQuery={query}
      initialView={deriveListing(BOARD, query)}
    />,
  );
}

const titles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

const tick = (name: string) => screen.findByRole("checkbox", { name: new RegExp(name) });

// Page one of the Marketing results: indices 10-24, ten to a page.
const MARKETING = Array.from({ length: 10 }, (_, i) => `Role ${i + 10}`);

// Nothing on screen changes when the board lands -- that is the point -- so
// there is no rendered thing to wait for. Flushing the fetch's microtasks
// inside act() is what commits it.
const board = async () => {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => undefined);
};

describe("before the board arrives", () => {
  // Whatever the server rendered is what stays on screen. No spinner, no
  // skeleton, no empty list: the page is already finished.
  it("shows the view the server derived", () => {
    mount();

    expect(titles()).toHaveLength(10);
    expect(screen.getByText("25", { selector: "strong" })).toBeTruthy();
  });

  it("falls back to the router when a facet is ticked", () => {
    mount();

    fireEvent.click(screen.getByRole("checkbox", { name: /Engineering/ }));

    expect(push).toHaveBeenCalledWith("/?team=Engineering", { scroll: false });
    expect(pushState).not.toHaveBeenCalled();
  });
});

describe("once the board is in memory", () => {
  it("changes nothing when it lands", async () => {
    mount();
    const before = titles();

    await board();

    expect(titles()).toEqual(before);
  });

  it("filters and writes the URL with no request at all", async () => {
    mount();
    await board();
    fetchMock.mockClear();

    fireEvent.click(await tick("Marketing"));

    await waitFor(() => expect(titles()).toEqual(MARKETING));
    expect(pushState).toHaveBeenCalledWith(null, "", "/?team=Marketing");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("pages without a request", async () => {
    mount();
    await board();
    fetchMock.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(titles()[0]).toBe("Role 10"));
    expect(url()).toBe("/?page=2");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Back and forward have to restore the state, not just the address bar.
  it("walks back and forward through the states it wrote", async () => {
    mount();
    await board();
    fireEvent.click(await tick("Marketing"));
    await waitFor(() => expect(titles()).toEqual(MARKETING));

    await travel(-1);

    expect(url()).toBe("/");
    expect(titles()[0]).toBe("Role 0");
    expect(await tick("Marketing")).toHaveProperty("checked", false);

    await travel(1);

    expect(url()).toBe("/?team=Marketing");
    expect(titles()).toEqual(MARKETING);
  });

  // The half-typed keyword filters the list but is never written to the URL:
  // nobody can link to it, and the server has never seen it.
  it("filters as the keyword box is typed, without touching the URL", async () => {
    mount();
    await board();

    fireEvent.change(screen.getByLabelText("Keywords"), { target: { value: "Role 22" } });

    await waitFor(() => expect(titles()).toEqual(["Role 22"]));
    expect(pushState).not.toHaveBeenCalled();
    expect(url()).toBe("/");
  });

  it("promotes the typed keyword to a chip, and the URL, on Add", async () => {
    mount();
    await board();

    fireEvent.change(screen.getByLabelText("Keywords"), { target: { value: "Role 24" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(url()).toBe("/?q=Role+24"));
    expect(titles()).toEqual(["Role 24"]);
  });
});
