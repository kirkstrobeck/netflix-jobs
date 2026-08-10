import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Listing } from "@/app/(site)/_listing/listing";
import { pushState, resetHistory, url } from "@/app/(site)/_listing/history.fixture";
import { board as asBoard, summary } from "@/lib/jobs/job-summary.fixture";
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
 * has to degrade honestly in front of.
 *
 * What "honestly" means changed. It used to mean a sentence saying the list had
 * fallen back to newest. Nearest no longer falls back: the country is in the
 * URL, the listing is already filtered by it, and the heading says so. So the
 * assertions below are that the heading names the country tier, and that the
 * page offers to sharpen it rather than apologising for it.
 */

// Ten US roles, newest first, so a change of order would be visible in the
// first title rather than only in a URL.
const BOARD = asBoard(
  Array.from({ length: 10 }, (_, i) => summary({ title: `Role ${i}` })),
);

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

const board = async () => {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => undefined);
};

const titles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

const sortOption = (name: string) => screen.getByRole("link", { name });

describe("the sort control", () => {
  it("sits on the results heading's line, as a control rather than a heading", async () => {
    mount();
    await board();

    const header = screen.getByRole("heading", { level: 2, name: "Open roles" })
      .parentElement;

    expect(header?.querySelector(".sort")).not.toBeNull();
    expect(screen.getByRole("group", { name: "Sort" })).toBeTruthy();
  });

  // THE HEADING DOES NOT CARRY THE SORT.
  //
  // It used to: a newest list was headed "Newest open roles". That prefix rode
  // on every default first load, captioning the control six inches to its right.
  // The anchor id is the half that was always fixed and still is.
  it("names the column without stating the order, keeping the anchor id fixed", async () => {
    mount();
    await board();

    const heading = screen.getByRole("heading", { level: 2, name: "Open roles" });

    expect(heading.id).toBe("open-roles");
    expect(heading.textContent).not.toContain("Newest");
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
  // given, so nothing is asked of the device -- and the list is the roles in
  // the country the URL names, which is a real answer to "nearest" at the
  // precision we actually have. The heading does not restate that country: the
  // URL carries it and the facets panel shows it ticked.
  it("leaves the heading plain when a link arrives already asking for nearest", async () => {
    mount({ ...EMPTY_QUERY, sort: "nearest" });
    await board();

    expect(sortOption("Nearest").getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("heading", { level: 2, name: "Open roles" })).toBeTruthy();
    expect(titles()[0]).toBe("Role 0");
  });

  // The grammar has to be true at the tier. "nearest to the United States" is
  // nonsense -- a country is not a point -- and it is exactly what one shared
  // sentence across all three tiers would produce. Removing the country from
  // the copy settled it, so the assertion is now that no country is there at
  // all.
  it("never claims to be nearest TO a country", async () => {
    mount({ ...EMPTY_QUERY, sort: "nearest" });
    await board();

    const heading = screen.getByRole("heading", { level: 2, name: /Open roles/ });

    expect(heading.textContent).not.toContain("nearest to");
    expect(heading.textContent).not.toContain("United States");
  });

  it("offers to sharpen the order instead of apologising for it", async () => {
    mount();
    await board();

    fireEvent.click(sortOption("Nearest"), { button: 0 });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Use my location" })).toBeTruthy(),
    );
    // Not one word about having fallen back to newest, because it has not.
    expect(document.body.textContent).not.toContain("newest first");
    // The URL is still shareable and still says what was asked for.
    expect(url()).toBe("/?country=US&sort=near");
    expect(titles()[0]).toBe("Role 0");
  });
});
