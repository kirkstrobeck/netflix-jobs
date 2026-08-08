import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/board/route";
import { boardBody } from "@/lib/jobs/board-payload";
import { summary } from "@/lib/jobs/job-summary.fixture";

vi.mock("@/lib/jobs/board-payload", () => ({ boardBody: vi.fn() }));

const bodyMock = vi.mocked(boardBody);

describe("GET /api/board", () => {
  it("serves the cached board bytes as JSON", async () => {
    const rows = [summary({ title: "Staff engineer" })];
    bodyMock.mockResolvedValue(JSON.stringify(rows));

    const response = await GET();

    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    await expect(response.json()).resolves.toEqual(rows);
  });

  // Reading anything off the request would make this per-visitor rather than one
  // prerendered file, so the handler deliberately takes no argument at all.
  it("takes no request, so it can be prerendered once for everyone", () => {
    expect(GET.length).toBe(0);
  });
});
