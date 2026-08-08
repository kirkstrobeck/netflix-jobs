import { cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { boardBody, boardVersion } from "@/lib/jobs/board-payload";
import { summary } from "@/lib/jobs/job-summary.fixture";
import { listJobSummaries } from "@/lib/jobs/list-jobs";

vi.mock("@/lib/jobs/list-jobs", () => ({ listJobSummaries: vi.fn() }));

const listMock = vi.mocked(listJobSummaries);

beforeEach(() => {
  vi.mocked(cacheTag).mockClear();
});

describe("boardBody", () => {
  it("serialises the rows the board fetch returned", async () => {
    const rows = [summary({ title: "Staff engineer" })];
    listMock.mockResolvedValue(rows);

    await expect(boardBody()).resolves.toBe(JSON.stringify(rows));
  });

  // The client parses this straight into the JobSummary[] that lib/search takes.
  // Any reshaping here would be a second definition of the row.
  it("sends the row shape unchanged", async () => {
    listMock.mockResolvedValue([summary()]);

    const [row] = JSON.parse(await boardBody());

    expect(Object.keys(row).sort()).toEqual(Object.keys(summary()).sort());
  });

  it("is tagged so the crawl flushes it with the listing", async () => {
    listMock.mockResolvedValue([]);

    await boardBody();

    expect(cacheTag).toHaveBeenCalledWith("jobs-board");
  });
});

describe("boardVersion", () => {
  it("is a short URL-safe digest", async () => {
    listMock.mockResolvedValue([summary()]);

    await expect(boardVersion()).resolves.toMatch(/^[\w-]{12}$/);
  });

  it("is the same for the same board", async () => {
    listMock.mockResolvedValue([summary({ title: "Same" })]);
    const first = await boardVersion();

    expect(await boardVersion()).toBe(first);
  });

  // The point of hashing the body rather than counting rows: a retitled job
  // leaves the count and the dates alone, and the browser still has to refetch.
  it("changes when a single field changes", async () => {
    listMock.mockResolvedValue([summary({ position_id: 1, title: "Before" })]);
    const before = await boardVersion();

    listMock.mockResolvedValue([summary({ position_id: 1, title: "After" })]);

    expect(await boardVersion()).not.toBe(before);
  });

  it("carries the board tag too, so it cannot outlive the body", async () => {
    listMock.mockResolvedValue([]);

    await boardVersion();

    expect(cacheTag).toHaveBeenCalledWith("jobs-board");
  });
});
