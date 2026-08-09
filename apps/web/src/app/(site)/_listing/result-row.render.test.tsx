import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultList } from "@/app/(site)/_listing/result-list";
import { summary } from "@/lib/jobs/job-summary.fixture";
import { formatPostedDate } from "@/lib/format/posted-date";

// Counting real renders needs something inside the row that can be counted, and
// the row's own work is the honest thing to count: it formats a date per render.
vi.mock("@/lib/format/posted-date", async (original) => {
  const actual = await original<typeof import("@/lib/format/posted-date")>();

  return { ...actual, formatPostedDate: vi.fn(actual.formatPostedDate) };
});

const formats = vi.mocked(formatPostedDate);

// The same objects a board hands out, reused across renders exactly as the real
// page reuses them: filtering rebuilds the ARRAY, never the rows.
const ROWS = Array.from({ length: 5 }, (_, i) => summary({ title: `Role ${i}` }));

beforeEach(() => formats.mockClear());
afterEach(cleanup);

describe("re-rendering the list", () => {
  it("renders each row once to begin with", () => {
    render(<ResultList jobs={ROWS} />);

    expect(formats).toHaveBeenCalledTimes(ROWS.length);
  });

  // The point of memo on the row. A keystroke rebuilds the page array on every
  // change, and if that alone re-rendered the rows, every result on screen would
  // re-format its dates and remount its PostedDate for a list that did not move.
  it("re-renders nothing when the array changes but the rows do not", () => {
    const { rerender } = render(<ResultList jobs={ROWS} />);
    formats.mockClear();

    rerender(<ResultList jobs={[...ROWS]} />);

    expect(formats).not.toHaveBeenCalled();
  });

  it("re-renders only the row that actually changed", () => {
    const { rerender } = render(<ResultList jobs={ROWS} />);
    formats.mockClear();

    const replaced = summary({ title: "Replaced" });
    rerender(<ResultList jobs={[replaced, ...ROWS.slice(1)]} />);

    expect(formats).toHaveBeenCalledTimes(1);
    expect(formats).toHaveBeenCalledWith(replaced.posting_date);
  });

  // Narrowing a filter drops rows off the end. The survivors keep their place
  // and their identity, so none of them is re-rendered.
  it("re-renders none of the survivors when the list is narrowed", () => {
    const { rerender } = render(<ResultList jobs={ROWS} />);
    formats.mockClear();

    rerender(<ResultList jobs={ROWS.slice(0, 2)} />);

    expect(formats).not.toHaveBeenCalled();
  });
});
