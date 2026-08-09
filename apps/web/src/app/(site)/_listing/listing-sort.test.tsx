import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Listing } from "@/app/(site)/_listing/listing";
import { pushState, resetHistory, url } from "@/app/(site)/_listing/history.fixture";
import { board as asBoard, summary } from "@/lib/jobs/job-summary.fixture";
import type { CountryDefault } from "@/lib/search/geo-query";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

vi.mock("next/navigation", async () => {
  const { navigationMock } = await import("@/app/(site)/_listing/history.fixture");

  return navigationMock();
});

/**
 * The sort control, from the outside.
 *
 * jsdom has neither navigator.geolocation nor navigator.permissions, and that
 * is not a limitation of this suite -- it is exactly the browser the feature
 * has to degrade honestly in front of. Every assertion below is therefore about
 * the two things that have to stay true when the position never arrives: the
 * list is the newest one, and the page says so.
 */

// Ten US roles, newest first, so a change of order would be visible in the
// first title rather than only in a URL.
const BOARD = asBoard(
  Array.from({ length: 10 }, (_, i) => summary({ title: `Role ${i}` })),
);

const DETECTED: CountryDefault = { countries: ["US"], from: "detected" };

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
  const applied = { ...query, country: DETECTED.countries };

  return render(
    <Listing
      boardVersion="v1"
      countryDefault={DETECTED}
      initialQuery={applied}
      initialView={deriveListing(BOARD, applied)}
    />,
  );
}

const board = async () => {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => undefined);
};

const titles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

const sortOption = (name: string) => screen.getByRole("link", { name });

describe("the sort control", () => {
  it("sits on the Open roles line, as a control rather than a heading", async () => {
    mount();
    await board();

    const header = screen.getByRole("heading", { level: 2, name: "Open roles" })
      .parentElement;

    expect(header?.querySelector(".sort")).not.toBeNull();
    expect(screen.getByRole("group", { name: "Sort" })).toBeTruthy();
  });

  it("says nothing about distance on a newest first load", async () => {
    mount();
    await board();

    expect(sortOption("Newest").getAttribute("aria-current")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the country already in the URL when the order changes", async () => {
    mount();
    await board();

    expect(sortOption("Nearest").getAttribute("href")).toBe("/?country=US&sort=near");
  });

  // The shared-link case. The URL asks for Nearest, no permission has been
  // given, so nothing is asked of the device -- and the list is still the
  // server's newest one, which the note says out loud rather than leaving the
  // control claiming an order the page is not in.
  it("waits to be pressed when a link arrives already asking for nearest", async () => {
    mount({ ...EMPTY_QUERY, sort: "nearest" });
    await board();

    expect(sortOption("Nearest").getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Choose Nearest");
    expect(titles()[0]).toBe("Role 0");
  });

  it("degrades to newest, out loud, when the browser cannot locate", async () => {
    mount();
    await board();

    fireEvent.click(sortOption("Nearest"), { button: 0 });

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "cannot share a location",
      ),
    );
    expect(screen.getByRole("status").textContent).toContain("newest first");
    // The URL is still shareable and still says what was asked for; what
    // changed is that the page is honest about not having managed it.
    expect(url()).toBe("/?country=US&sort=near");
    expect(titles()[0]).toBe("Role 0");
  });
});
