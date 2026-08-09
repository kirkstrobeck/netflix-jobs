import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Listing } from "@/app/(site)/_listing/listing";
import {
  pushState,
  resetHistory,
  travel,
  url,
} from "@/app/(site)/_listing/history.fixture";
import { board as asBoard, summary } from "@/lib/jobs/job-summary.fixture";
import type { CountryDefault } from "@/lib/search/geo-query";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

vi.mock("next/navigation", async () => {
  const { navigationMock } = await import("@/app/(site)/_listing/history.fixture");

  return navigationMock();
});

/**
 * The client half of "first load only".
 *
 * The server turned "this request came from the US" into `?country=US` and
 * rendered from that. The browser then has to reach the SAME answer for the
 * same URL, twice over: once at mount, and again when a Back button lands on
 * the bare `/` that the country was never written into. It applies the default
 * through the same pure function the server used, which is what makes those
 * two answers the same one rather than two that happen to agree today.
 */

// 25 US roles and one in Tokyo, so widening is visible in the count rather
// than only in a URL: 26 is every country, 25 is the United States, 1 Japan.
const WORLD = asBoard([
  ...Array.from({ length: 25 }, (_, i) => summary({ title: `Role ${i}` })),
  summary({ title: "Tokyo role", sites: ["jp-tokyo"] }),
]);

const DETECTED: CountryDefault = { countries: ["US"], from: "detected" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetHistory();
  vi.stubGlobal("fetch", (fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => WORLD,
  }))));
  vi.stubGlobal("history", { pushState });
  document.cookie = "nfj_country=; max-age=0; path=/";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(query: JobQuery, countryDefault: CountryDefault) {
  return render(
    <Listing
      boardVersion="v1"
      countryDefault={countryDefault}
      initialQuery={query}
      initialView={deriveListing(WORLD, query)}
    />,
  );
}

const board = async () => {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => undefined);
};

const tick = (name: string) => screen.findByRole("checkbox", { name: new RegExp(name) });

describe("the detected country, in the browser", () => {
  it("stays applied when Back lands on a URL that never carried it", async () => {
    mount({ ...EMPTY_QUERY, country: ["US"] }, DETECTED);
    await board();

    fireEvent.click(await tick("Engineering"));
    await waitFor(() => expect(url()).toBe("/?country=US&team=Engineering"));

    await travel(-1);

    // The URL is bare, and the listing is still the United States -- not the
    // whole world. Re-reading the URL alone would silently widen it to 26.
    expect(url()).toBe("/");
    expect(screen.getByText(/of 25 roles/)).toBeTruthy();
  });

  /**
   * And the other half: an explicit answer in the URL is never answered over,
   * on the client either. `?country=all` and a bare `/` render identically and
   * mean the opposite things, which is the distinction the flag exists for.
   */
  it("keeps its hands off an explicit everywhere", async () => {
    resetHistory("/?country=all");
    mount({ ...EMPTY_QUERY, everywhere: true }, { countries: [], from: "detected" });
    await board();

    expect(screen.getByText(/of 26 roles/)).toBeTruthy();
  });

  // The visitor's own change wins and is written down, so the NEXT request
  // carries it instead of asking the edge again. This is the line between a
  // country they picked and one that was picked for them.
  it("remembers a country the visitor unticks", async () => {
    mount({ ...EMPTY_QUERY, country: ["US"] }, DETECTED);
    await board();

    fireEvent.click(await tick("United States"));

    await waitFor(() => expect(url()).toBe("/?country=all"));
    expect(document.cookie).toContain("nfj_country=all");
    expect(screen.getByText(/of 26 roles/)).toBeTruthy();
  });

  // Filtering by something else must NOT write the cookie. If it did, a first
  // load followed by any click at all would promote the detected country into
  // a remembered choice, and detection would become permanent.
  it("does not remember anything when another facet is used", async () => {
    mount({ ...EMPTY_QUERY, country: ["US"] }, DETECTED);
    await board();

    fireEvent.click(await tick("Engineering"));

    await waitFor(() => expect(url()).toBe("/?country=US&team=Engineering"));
    expect(document.cookie).not.toContain("nfj_country");
  });
});
