import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Listing } from "@/app/(site)/_listing/listing";
import {
  push,
  pushState,
  resetHistory,
  travel,
  url,
} from "@/app/(site)/_listing/history.fixture";
import { board as asBoard, summary } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

vi.mock("next/navigation", async () => {
  const { navigationMock } = await import("@/app/(site)/_listing/history.fixture");

  return navigationMock();
});

// 25 roles over two teams: two pages, and a facet worth counting. All of them
// are in the United States, which is also what the request below was matched
// to -- so the country is present in every URL and narrows nothing, and the
// assertions stay about the control that was actually clicked.
const BOARD = asBoard(
  Array.from({ length: 25 }, (_, i) =>
    summary({
      title: `Role ${i}`,
      team: i < 10 ? "Engineering" : "Marketing",
      work_type: i % 2 === 0 ? "Onsite" : "Remote",
    }),
  ),
);

// What the server resolved the request to, handed down as a prop.
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetHistory();
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
  const applied = { ...query, country: ["US"] };

  return render(
    <Listing
      boardVersion="v1"
      initialQuery={applied}
      initialView={deriveListing(BOARD, applied)}
    />,
  );
}

const titles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

const tick = (name: string) => screen.findByRole("checkbox", { name: new RegExp(name) });

// The Marketing results: indices 10-24, and all fifteen fit on one page.
const MARKETING = Array.from({ length: 15 }, (_, i) => `Role ${i + 10}`);

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

    expect(titles()).toHaveLength(20);
    expect(screen.getByText(/Showing 1 thru 20 of 25 roles/)).toBeTruthy();
  });

  it("falls back to the router when a facet is ticked", () => {
    mount();

    fireEvent.click(screen.getByRole("checkbox", { name: /Engineering/ }));

    expect(push).toHaveBeenCalledWith("/?country=US&team=Engineering", { scroll: false });
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
    expect(pushState).toHaveBeenCalledWith(null, "", "/?country=US&team=Marketing");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  // The address carries the heading the browser is about to jump to, so the URL
  // in the bar is the one that reproduces the screen -- fragment included -- if
  // it is copied to someone else.
  it("pages without a request, landing on the results heading", async () => {
    mount();
    await board();
    fetchMock.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(titles()[0]).toBe("Role 20"));
    expect(url()).toBe("/?country=US&page=2#open-roles");
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

    expect(url()).toBe("/?country=US&team=Marketing");
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

    await waitFor(() => expect(url()).toBe("/?country=US&q=Role+24"));
    expect(titles()).toEqual(["Role 24"]);
  });
});
