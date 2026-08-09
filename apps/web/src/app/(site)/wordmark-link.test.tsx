import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Listing } from "@/app/(site)/_listing/listing";
import { pushState, resetHistory, travel, url } from "@/app/(site)/_listing/history.fixture";
import { BoardLink } from "@/app/(site)/wordmark-link";
import { board as asBoard, summary } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

vi.mock("next/navigation", async () => {
  const { navigationMock } = await import("@/app/(site)/_listing/history.fixture");

  return navigationMock();
});

// The same 25 roles the listing suite filters, for the same reason: two teams
// worth ticking, and every one of them in the United States, so the country is
// in every URL and narrows nothing.
const BOARD = asBoard(
  Array.from({ length: 25 }, (_, i) =>
    summary({
      title: `Role ${i}`,
      team: i < 10 ? "Engineering" : "Marketing",
      work_type: i % 2 === 0 ? "Onsite" : "Remote",
    }),
  ),
);

const SERVED = "/?country=US";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Started where the document was served, not at "/", because that is the
  // whole subject: the href is right on arrival and has to survive what
  // happens next.
  resetHistory(SERVED);
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

// The mark and the panel on one page, which is the arrangement the bug lives
// in: they are in different trees -- the marks come from the @header and
// @footer slots, the panel from the page -- and share nothing but the URL.
function mount() {
  const applied = { ...EMPTY_QUERY, country: ["US"] };

  return render(
    <>
      <BoardLink className="wordmark" href={SERVED}>
        Netflix Jobs
      </BoardLink>
      <Listing
        boardVersion="v1"
        initialQuery={applied}
        initialView={deriveListing(BOARD, applied)}
      />
    </>,
  );
}

const mark = () => screen.getByRole("link", { name: "Netflix Jobs" }).getAttribute("href");

const tick = (name: string) => screen.findByRole("checkbox", { name: new RegExp(name) });

// The board has to be in memory before a tick is a pushState rather than a
// router push -- see use-listing.ts. Nothing on screen changes when it lands,
// so there is nothing to wait for but the fetch's own microtasks.
const board = async () => {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => undefined);
};

// A facet tick costs no round trip, so the slots the marks live in do not
// re-render for it. A mark that only ever knew the href it was served with
// therefore points at the board the visitor had a tick ago -- and clicking it
// throws away the tick.
describe("the board's wordmark", () => {
  it("starts at the address the document was served from", () => {
    mount();

    expect(mark()).toBe(SERVED);
  });

  it("follows the URL the panel pushes, exactly", async () => {
    mount();
    await board();

    fireEvent.click(await tick("Marketing"));

    await waitFor(() => expect(mark()).toBe("/?country=US&team=Marketing"));
    // Not "looks like" the pushed URL -- IS the pushed string. One serializer,
    // so the mark and the checkbox cannot spell one state two ways.
    expect(mark()).toBe(pushState.mock.calls.at(-1)?.[2]);
  });

  it("keeps up over several ticks, not just the first", async () => {
    mount();
    await board();

    fireEvent.click(await tick("Marketing"));
    await waitFor(() => expect(mark()).toBe("/?country=US&team=Marketing"));
    fireEvent.click(await tick("Remote"));

    await waitFor(() => expect(mark()).toBe("/?country=US&type=Remote&team=Marketing"));
    expect(mark()).toBe(pushState.mock.calls.at(-1)?.[2]);
  });

  it("goes back to the bare board when the last facet is unticked", async () => {
    mount();
    await board();

    fireEvent.click(await tick("Marketing"));
    await waitFor(() => expect(mark()).toBe("/?country=US&team=Marketing"));
    fireEvent.click(await tick("Marketing"));

    await waitFor(() => expect(mark()).toBe("/?country=US"));
  });

  // Reading the URL rather than being told about the push is what makes this
  // one free: Back is the same subscription arriving from the other direction.
  it("follows the Back button too", async () => {
    mount();
    await board();
    fireEvent.click(await tick("Marketing"));
    await waitFor(() => expect(mark()).toBe("/?country=US&team=Marketing"));

    await travel(-1);

    expect(url()).toBe(SERVED);
    expect(mark()).toBe(SERVED);
  });

  // A page link pushes "...#open-roles", because the browser is the thing that
  // scrolls. The fragment is an instruction for that navigation, not part of
  // the listing's state, so it has no business in the mark's address.
  it("carries the page, and not the fragment the pager pushes", async () => {
    mount();
    await board();

    fireEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(url()).toBe("/?country=US&page=2#open-roles"));
    expect(mark()).toBe("/?country=US&page=2");
  });

  // The half-typed keyword filters the list and is deliberately never written
  // to the URL. The mark is an address, so it shows what a visitor could
  // actually be sent -- which is the state without it.
  it("ignores the keyword being typed, exactly as the URL does", async () => {
    mount();
    await board();

    fireEvent.change(screen.getByLabelText("Keywords"), { target: { value: "Role 22" } });

    await waitFor(() => expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1));
    expect(mark()).toBe(SERVED);
    expect(pushState).not.toHaveBeenCalled();
  });
});
