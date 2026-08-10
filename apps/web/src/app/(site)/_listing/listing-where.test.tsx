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
 * The tier that names a place and filters nothing -- now that it names nothing
 * either.
 *
 * A visitor who cleared the country and asked for Nearest has answered
 * "everywhere" and given us no position. The edge still knows which country the
 * request came from, and the heading used to say so in a clause of its own. The
 * clause is gone: the URL already carries the country wherever there is one to
 * carry, and the facets panel already shows it, so the heading was restating a
 * filter rather than adding anything.
 *
 * What still matters here is that the answer from /api/where cannot leak into
 * the heading OR into the list. A heading reading "Open roles in the United
 * States" over twenty-six roles in two countries was a filter the visitor could
 * read and believe and that was not there; the fix removed the sentence, and
 * these tests are what keep it removed.
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

// The answer has landed and been given every chance to reach the heading.
async function settle() {
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await act(async () => undefined);
}

describe("the heading when the edge knows the country and the URL does not", () => {
  it("stays a bare Open roles rather than naming the country", async () => {
    respond("US");
    await mount();
    await settle();

    expect(title().textContent).toBe("Open roles");
  });

  // The clause was a separate element so a media query could drop it on a
  // narrow screen. With the copy gone there is nothing to drop, and the heading
  // is a single text node again.
  it("leaves no clause element behind for a stylesheet to hide", async () => {
    respond("US");
    await mount();
    await settle();

    const heading = title();

    expect(heading.querySelector(".listing-title__where")).toBeNull();
    expect(heading.textContent?.match(/Open roles/g)).toHaveLength(1);
  });

  it("leaves every role on the board, including the ones in other countries", async () => {
    respond("US");
    await mount();
    await settle();

    expect(screen.getByRole("heading", { level: 3, name: "Tokyo role" })).toBeTruthy();
  });

  /**
   * The fail-closed path, which the removal made indistinguishable from the
   * happy one. A country with no roles on this board never had anything to be
   * called; now neither does a country that has them.
   */
  it("says the same thing when the country it was told has no roles here", async () => {
    respond("BR");
    await mount();
    await settle();

    expect(title().textContent).toBe("Open roles");
  });
});
