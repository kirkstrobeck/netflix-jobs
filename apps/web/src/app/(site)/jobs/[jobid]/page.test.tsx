import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";

vi.mock("@/lib/jobs/get-job", () => ({ getJob: vi.fn() }));
vi.mock("@/lib/jobs/job-ids", () => ({ listRecentJobIds: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import JobPage, { generateMetadata, generateStaticParams } from "@/app/(site)/jobs/[jobid]/page";
import { getJob } from "@/lib/jobs/get-job";
import { listRecentJobIds } from "@/lib/jobs/job-ids";
import { notFound } from "next/navigation";

const params = Promise.resolve({ jobid: "JR73020" });

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateStaticParams", () => {
  it("maps recent job ids onto the jobid route param", async () => {
    vi.mocked(listRecentJobIds).mockResolvedValue(["JR1", "JR2"]);

    const result = await generateStaticParams();

    expect(result).toEqual([{ jobid: "JR1" }, { jobid: "JR2" }]);
  });
});

describe("generateMetadata", () => {
  it("builds title, description, and canonical from the job", async () => {
    vi.mocked(getJob).mockResolvedValue(SAMPLE_JOB);

    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe(`${SAMPLE_JOB.title} — Netflix Jobs`);
    expect(metadata.description).toBe(SAMPLE_JOB.description_text.slice(0, 155).trim());
    expect(metadata.alternates).toEqual({ canonical: SAMPLE_JOB.canonical_url });
  });

  it("falls back to a generic description when description_text is empty", async () => {
    vi.mocked(getJob).mockResolvedValue({ ...SAMPLE_JOB, description_text: "" });

    const metadata = await generateMetadata({ params });

    expect(metadata.description).toBe(`${SAMPLE_JOB.title} at Netflix.`);
  });

  it("calls notFound when the job does not exist", async () => {
    vi.mocked(getJob).mockResolvedValue(null);

    await expect(generateMetadata({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

describe("JobPage", () => {
  it("renders the header, description, and details for a found job", async () => {
    vi.mocked(getJob).mockResolvedValue(SAMPLE_JOB);

    const html = renderToStaticMarkup(await JobPage({ params }));

    expect(html).toContain(SAMPLE_JOB.title);
    expect(html).toContain("About the role");
    expect(html).toContain("Job details");
  });

  it("calls notFound when the job does not exist", async () => {
    vi.mocked(getJob).mockResolvedValue(null);

    await expect(JobPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
