import { describe, expect, it } from "vitest";

import { PAGE_SIZE, pageSlice, paginate } from "@/lib/search/paginate";

describe("paginate", () => {
  it("puts ten per page and counts the pages", () => {
    expect(PAGE_SIZE).toBe(10);
    expect(paginate(481, 1).pageCount).toBe(49);
    expect(paginate(30, 1).pageCount).toBe(3);
  });

  // A partial last page is still a page.
  it("rounds a partial last page up", () => {
    expect(paginate(31, 1).pageCount).toBe(4);
    expect(paginate(1, 1).pageCount).toBe(1);
  });

  it("reports the window as 1-indexed positions", () => {
    const first = paginate(481, 1);
    expect([first.from, first.to]).toEqual([1, 10]);

    const third = paginate(481, 3);
    expect([third.from, third.to]).toEqual([21, 30]);
  });

  // The last page stops at the total, not at a round ten.
  it("stops the last page at the total", () => {
    const last = paginate(24, 3);

    expect([last.from, last.to, last.pageCount]).toEqual([21, 24, 3]);
    expect(last.hasNext).toBe(false);
    expect(last.hasPrevious).toBe(true);
  });

  it("is page 1 of 1 with a 0 to 0 window when nothing matched", () => {
    const empty = paginate(0, 1);

    expect(empty).toMatchObject({
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      total: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });

  // A filter change can shrink the results under the page someone was on.
  // Clamping shows the last page; 404 would be a worse answer.
  it("clamps a page past the end back to the last page", () => {
    expect(paginate(24, 99).page).toBe(3);
    expect(paginate(24, 99).from).toBe(21);
    expect(paginate(0, 99).page).toBe(1);
  });

  it("clamps a page below the start back to the first", () => {
    expect(paginate(24, 0).page).toBe(1);
    expect(paginate(24, -5).page).toBe(1);
  });

  it("has no previous on the first page and no next on the last", () => {
    expect(paginate(100, 1)).toMatchObject({ hasPrevious: false, hasNext: true });
    expect(paginate(100, 10)).toMatchObject({ hasPrevious: true, hasNext: false });
    expect(paginate(100, 5)).toMatchObject({ hasPrevious: true, hasNext: true });
  });

  it("is a single page with no neighbours when everything fits", () => {
    expect(paginate(10, 1)).toMatchObject({
      pageCount: 1,
      hasPrevious: false,
      hasNext: false,
      from: 1,
      to: 10,
    });
  });
});

describe("pageSlice", () => {
  const items = Array.from({ length: 24 }, (_, i) => i + 1);

  it("cuts the window the page describes", () => {
    expect(pageSlice(items, paginate(24, 1))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pageSlice(items, paginate(24, 3))).toEqual([21, 22, 23, 24]);
  });

  it("cuts from the clamped page, not the requested one", () => {
    expect(pageSlice(items, paginate(24, 99))).toEqual([21, 22, 23, 24]);
  });

  it("is empty when there is nothing to show", () => {
    expect(pageSlice([], paginate(0, 1))).toEqual([]);
  });
});
