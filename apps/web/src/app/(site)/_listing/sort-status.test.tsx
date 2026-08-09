import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SortStatus } from "@/app/(site)/_listing/sort-status";
import type { NearestStatus } from "@/app/(site)/_listing/use-nearest";

// This suite is not run with vitest's globals, so RTL's automatic cleanup is
// never registered and renders would pile up across tests.
afterEach(cleanup);

const text = (status: NearestStatus) => {
  const { container } = render(<SortStatus status={status} />);

  return container.textContent ?? "";
};

describe("SortStatus", () => {
  it("says nothing when the sort worked", () => {
    expect(text("ready")).toBe("");
  });

  it("says it is working while it waits", () => {
    expect(text("locating")).toContain("Finding your location");
  });

  // The honesty requirement, one case per way it can fail. Each sentence says
  // BOTH halves: what happened, and what is therefore on screen -- because in
  // every one of these the list really is newest.
  it.each(["denied", "unavailable", "timeout", "unsupported", "failed"] as const)(
    "explains %s and admits the list is newest",
    (status) => {
      expect(text(status)).toContain("newest first");
    },
  );

  it("names the reason rather than giving one message for everything", () => {
    expect(text("denied")).toContain("blocked");
    expect(text("timeout")).toContain("too long");
    expect(text("unavailable")).toContain("could not work out where it is");
    expect(text("unsupported")).toContain("cannot share a location");
  });

  // The shared-link case: the URL asks for Nearest, no permission has been
  // given, and nothing has gone wrong -- so it says what to do, not what broke.
  it("asks for a press when nothing has been requested yet", () => {
    expect(text("idle")).toContain("Choose Nearest");
  });

  // Announced politely when it appears, because filtering and sorting happen
  // without a page load.
  it("announces itself to assistive tech", () => {
    render(<SortStatus status="denied" />);

    expect(screen.getByRole("status")).toBeTruthy();
  });
});
