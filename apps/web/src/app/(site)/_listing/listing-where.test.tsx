import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Listing } from "@/app/(site)/_listing/listing";
import { pushState, resetHistory } from "@/app/(site)/_listing/history.fixture";
import { board as asBoard, summary } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

vi.mock("next/navigation", async () => {
  const { navigationMock } = await import("@/app/(site)/_listing/history.fixture");

  return navigationMock();
});

/**
 * The tier that names a place and filters nothing.
 *
 * A visitor who cleared the country and asked for Nearest has answered
 * "everywhere" and given us no position. The edge still knows which country the
 * request came from, so the heading may SAY it -- but the list is every open
 * role, and a heading reading "Open roles in the United States" over twenty-six
 * roles in two countries is a filter the visitor can read and believe and that
 * is not there.
 *
 * So the clause is a separate element rather than a longer string: at 320px the
 * whole sentence wraps to three lines and takes the list down the page with it,
 * and jobs-listing.css drops the clause rather than the heading.
 */

// One role in Tokyo and 25 in the United States, the Tokyo one first so it is
// on the first page. If the request tier ever started narrowing, it is the role
// that would vanish.
const WORLD = asBoard([
  summary({ title: "Tokyo role", sites: ["jp-tokyo"] }),
  ...Array.from({ length: 25 }, (_, i) => summary({ title: `Role ${i}` })),
]);

function respond(country: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(input).includes("/api/where") ? { country } : WORLD,
    })),
  );
}

beforeEach(() => {
  resetHistory();
  vi.stubGlobal("history", { pushState });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Nearest, with the country question answered "everywhere": no country ticked
// and no office ticked, which is what lets the request tier speak at all.
const EVERYWHERE: JobQuery = { ...EMPTY_QUERY, sort: "nearest" };

async function mount() {
  const view = render(
    <Listing
      boardVersion="v1"
      initialQuery={EVERYWHERE}
      initialView={deriveListing(WORLD, EVERYWHERE)}
    />,
  );

  await act(async () => undefined);

  return view;
}

// The results heading specifically -- the facets panel has an h2 of its own.
const title = () => document.querySelector(".listing-title")!;

describe("the heading when the edge knows the country and the URL does not", () => {
  it("names the country as a fact about the reader, not about the list", async () => {
    respond("US");
    await mount();

    await waitFor(() =>
      expect(title().textContent).toBe("Open roles — you are in the United States"),
    );
  });

  // The clause is added to the lead, never a second copy of it. A stylesheet
  // that never arrives has to show the long sentence, not the word twice.
  it("writes 'Open roles' once, in a clause the stylesheet is allowed to drop", async () => {
    respond("US");
    await mount();

    await waitFor(() =>
      expect(document.querySelector(".listing-title__where")).toBeTruthy(),
    );

    const heading = title();

    expect(heading.textContent?.match(/Open roles/g)).toHaveLength(1);
    expect(heading.querySelector(".listing-title__where")?.textContent).toBe(
      " — you are in the United States",
    );
  });

  it("leaves every role on the board, including the ones in other countries", async () => {
    respond("US");
    await mount();

    await waitFor(() =>
      expect(document.querySelector(".listing-title__where")).toBeTruthy(),
    );

    expect(screen.getByRole("heading", { level: 3, name: "Tokyo role" })).toBeTruthy();
  });

  /**
   * The fail-closed path. The facet list only names countries this board hires
   * in, so a request placed somewhere with no roles has nothing to be called --
   * and the heading stays plain rather than naming a country the board has
   * never heard of.
   */
  it("says nothing when the country it was told has no roles on this board", async () => {
    respond("BR");
    await mount();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => undefined);

    expect(title().textContent).toBe("Open roles");
    expect(document.querySelector(".listing-title__where")).toBeNull();
  });
});
