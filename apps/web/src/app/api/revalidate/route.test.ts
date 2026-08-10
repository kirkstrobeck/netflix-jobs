// @vitest-environment node

import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/revalidate/route";

const SECRET = "correct-horse-battery-staple";

const revalidateTagMock = vi.mocked(revalidateTag);

type PostInit = { secret?: string; body?: string };

function post(init: PostInit = {}): Request {
  const headers = new Headers();
  if (init.secret !== undefined) {
    headers.set("x-revalidate-secret", init.secret);
  }

  return new Request("http://localhost:3000/api/revalidate", {
    method: "POST",
    headers,
    body: init.body,
  });
}

async function call(init: PostInit = {}): Promise<{ status: number; body: unknown }> {
  const res = await POST(post(init));
  return { status: res.status, body: await res.json() };
}

function tags(): string[] {
  return revalidateTagMock.mock.calls.map(([tag]) => tag);
}

beforeEach(() => {
  revalidateTagMock.mockClear();
  vi.stubEnv("REVALIDATE_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth", () => {
  it("401s without the header", async () => {
    const { status, body } = await call();

    expect(status).toBe(401);
    expect(body).toEqual({ revalidated: false, error: "unauthorized" });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("401s on a wrong secret", async () => {
    const { status } = await call({ secret: "wrong-horse-battery-staple" });

    expect(status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  // The digest-then-compare exists for this case: timingSafeEqual throws on a
  // length mismatch, so a short guess must be a 401 like any other, not a 500.
  it("401s on a secret of a different length", async () => {
    const { status } = await call({ secret: "x" });

    expect(status).toBe(401);
  });

  // Fail closed: an unconfigured deployment must not accept every caller.
  it("401s when REVALIDATE_SECRET is unset, even with a header", async () => {
    vi.stubEnv("REVALIDATE_SECRET", undefined);

    const { status } = await call({ secret: SECRET });

    expect(status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});

describe("revalidation", () => {
  it("flushes the board tag on an empty body", async () => {
    const { status, body } = await call({ secret: SECRET });

    expect(status).toBe(200);
    expect(body).toEqual({
      revalidated: true,
      board: true,
      jobIds: [],
      tags: ["jobs-board"],
      profile: { expire: 0 },
    });
    expect(revalidateTagMock).toHaveBeenCalledExactlyOnceWith("jobs-board", { expire: 0 });
  });

  it("flushes named jobs in addition to the board by default", async () => {
    const { status, body } = await call({
      secret: SECRET,
      body: JSON.stringify({ jobIds: ["JR41912", "AJRT30201"] }),
    });

    expect(status).toBe(200);
    expect(tags()).toEqual(["jobs-board", "job:JR41912", "job:AJRT30201"]);
    expect(body).toMatchObject({ board: true, jobIds: ["JR41912", "AJRT30201"] });
  });

  it("flushes only the named jobs when board is false", async () => {
    const { status, body } = await call({
      secret: SECRET,
      body: JSON.stringify({ jobIds: ["JR41912"], board: false }),
    });

    expect(status).toBe(200);
    expect(tags()).toEqual(["job:JR41912"]);
    expect(body).toMatchObject({ board: false, tags: ["job:JR41912"] });
  });

  // jobTag uppercases, so the two spellings are one tag and one call.
  it("dedupes ids that differ only in casing", async () => {
    await call({ secret: SECRET, body: JSON.stringify({ jobIds: ["jr41912", "JR41912"] }) });

    expect(tags()).toEqual(["jobs-board", "job:JR41912"]);
  });

  it("accepts an empty jobIds array as a board-only call", async () => {
    const { status } = await call({ secret: SECRET, body: JSON.stringify({ jobIds: [] }) });

    expect(status).toBe(200);
    expect(tags()).toEqual(["jobs-board"]);
  });
});

describe("body validation", () => {
  it("400s on unparseable JSON", async () => {
    const { status, body } = await call({ secret: SECRET, body: "{not json" });

    expect(status).toBe(400);
    expect(body).toEqual({ revalidated: false, error: "body must be a JSON object" });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("400s on a JSON array", async () => {
    const { status, body } = await call({ secret: SECRET, body: "[]" });

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "body must be a JSON object" });
  });

  it("400s when jobIds is not an array", async () => {
    const { status, body } = await call({
      secret: SECRET,
      body: JSON.stringify({ jobIds: "JR41912" }),
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "jobIds must be an array of non-empty strings" });
  });

  it("400s when jobIds holds a blank or non-string entry", async () => {
    const { status } = await call({
      secret: SECRET,
      body: JSON.stringify({ jobIds: ["JR41912", "  ", 7] }),
    });

    expect(status).toBe(400);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("400s when board is not a boolean", async () => {
    const { status, body } = await call({
      secret: SECRET,
      body: JSON.stringify({ board: "yes" }),
    });

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "board must be a boolean" });
  });

  it("400s when the request asks for nothing", async () => {
    const { status, body } = await call({ secret: SECRET, body: JSON.stringify({ board: false }) });

    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: "nothing to revalidate: board is false and jobIds is empty",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
