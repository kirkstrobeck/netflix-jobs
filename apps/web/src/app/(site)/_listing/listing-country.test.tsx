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
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

vi.mock("next/navigation", async () => {
  const { navigationMock } = await import("@/app/(site)/_listing/history.fixture");

  return navigationMock();
});

/**
 * The country, in the browser, now that the URL always carries it.
 *
 * This suite used to be about the client re-deriving a country the URL had
 * failed to mention -- applying the same detected default the server had, so a
 * Back button onto a bare `/` did not silently widen the listing from one
 * country to every country. There is no such URL any more: proxy.ts redirects
 * before the listing renders, so the address the browser is sitting on names
 * the country, and every link built from it carries the country forward.
 *
 * So what is left to pin is the opposite claim. The client reads the URL and
 * NOTHING else -- no default, no cookie, no second opinion -- and the cookie is
 * still written by exactly the two controls that answer the country question.
 */

// 25 US roles and one in Tokyo, so widening is visible in the count rather
// than only in a URL: 26 is every country, 25 is the United States, 1 Japan.
const WORLD = asBoard([
  ...Array.from({ length: 25 }, (_, i) => summary({ title: `Role ${i}` })),
  summary({ title: "Tokyo role", sites: ["jp-tokyo"] }),
]);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetHistory("/?country=US");
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

function mount(query: JobQuery) {
  return render(
    <Listing
      boardVersion="v1"
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

describe("the country, in the browser", () => {
  it("restores exactly what the URL says when Back lands on it", async () => {
    mount({ ...EMPTY_QUERY, country: ["US"] });
    await board();

    fireEvent.click(await tick("Engineering"));
    await waitFor(() => expect(url()).toBe("/?country=US&team=Engineering"));

    await travel(-1);

    // The country came back because the URL carries it, not because anything
    // re-applied it. The address the visitor returns to is the address they
    // came from, spelled out.
    expect(url()).toBe("/?country=US");
    expect(screen.getByText(/of 25 roles/)).toBeTruthy();
  });

  /**
   * A bare `/` is everywhere. It is also what a visitor who has not been asked
   * lands on -- the two are the same address on purpose, and what tells them
   * apart is the cookie, one hop before this renders.
   */
  it("reads a URL that names no country as everywhere", async () => {
    resetHistory("/");
    mount(EMPTY_QUERY);
    await board();

    expect(screen.getByText(/of 26 roles/)).toBeTruthy();
  });

  // The visitor's own change wins and is written down, so the NEXT request
  // carries it instead of asking the edge again. This is the line between a
  // country they picked and one that was picked for them.
  //
  // The URL it lands on is a bare `/` -- there is no `?country=all` to leave
  // behind -- so the cookie is carrying the whole of "and I meant it". Without
  // the write, reloading this address would detect the country again and put
  // the visitor straight back where they just left.
  it("remembers everywhere when the visitor unticks their last country", async () => {
    mount({ ...EMPTY_QUERY, country: ["US"] });
    await board();

    fireEvent.click(await tick("United States"));

    await waitFor(() => expect(url()).toBe("/"));
    expect(document.cookie).toContain("nfj_country=all");
    expect(screen.getByText(/of 26 roles/)).toBeTruthy();
  });

  // Filtering by something else must NOT write the cookie. If it did, a first
  // load followed by any click at all would promote the country the edge
  // matched into a remembered choice, and detection would become permanent.
  it("does not remember anything when another facet is used", async () => {
    mount({ ...EMPTY_QUERY, country: ["US"] });
    await board();

    fireEvent.click(await tick("Engineering"));

    await waitFor(() => expect(url()).toBe("/?country=US&team=Engineering"));
    expect(document.cookie).not.toContain("nfj_country");
  });
});
