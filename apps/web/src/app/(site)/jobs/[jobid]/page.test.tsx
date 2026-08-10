import { cacheLife, cacheTag } from "next/cache";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SITES } from "@/lib/jobs/job-summary.fixture";
import { MINIMAL_JOB, SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { checkBreadcrumbList } from "@/lib/seo/rules/breadcrumb-rules";
import { checkJobPosting } from "@/lib/seo/rules/job-posting-rules";

vi.mock("@/lib/jobs/get-job", () => ({ getJob: vi.fn() }));
vi.mock("@/lib/jobs/job-ids", () => ({ listRecentJobIds: vi.fn() }));
vi.mock("@/lib/jobs/list-sites", () => ({ listSites: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import JobPage, { generateMetadata, generateStaticParams } from "@/app/(site)/jobs/[jobid]/page";
import { getJob } from "@/lib/jobs/get-job";
import { listRecentJobIds } from "@/lib/jobs/job-ids";
import { listSites } from "@/lib/jobs/list-sites";
import { notFound } from "next/navigation";

const params = Promise.resolve({ jobid: "JR73020" });

beforeEach(() => {
  // The page loads the site table beside the posting -- it is what turns the
  // posting's location slugs into words and into links.
  vi.mocked(listSites).mockResolvedValue(SITES);
});

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

  // ONE ENTRY PER POSTING, NAMED AFTER THAT POSTING AND NOTHING ELSE.
  //
  // The board tag is deliberately absent, here and on getJob. It used to be on
  // both, so that "the crawl ran" flushed all 481 job pages at once; the
  // ingestor now compares checksums and names the roles that moved, and keeping
  // the blunt tag would put every posting inside the blast radius of one added
  // role.
  it("caches the rendered article under this job's tag alone", async () => {
    vi.mocked(getJob).mockResolvedValue(SAMPLE_JOB);

    await JobPage({ params });

    expect(cacheLife).toHaveBeenCalledWith("jobs");
    expect(cacheTag).toHaveBeenCalledWith("job:JR73020");
    expect(cacheTag).not.toHaveBeenCalledWith("jobs-board");
  });

  // notFound() throws a navigation signal, and a signal thrown out of a cached
  // function would put "this is a 404" in the cache entry. The miss is spelled
  // as a returned null inside the scope and answered outside it.
  it("calls notFound when the job does not exist", async () => {
    vi.mocked(getJob).mockResolvedValue(null);

    await expect(JobPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

// Not "the builder returns the right object" -- that is job-posting.test.ts.
// This parses the JSON back out of the HTML the page actually renders and runs
// the spec rules over it, so a script tag that never got added, or one whose
// payload the encoder mangled, fails here.
async function emitted(job: typeof SAMPLE_JOB) {
  vi.mocked(getJob).mockResolvedValue(job);

  const html = renderToStaticMarkup(await JobPage({ params }));
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  return blocks.map((block) => JSON.parse(block[1].replace(/\\u003c/g, "<")));
}

describe("the JSON-LD the job page emits", () => {
  it("validates against Google's JobPosting and BreadcrumbList rules", async () => {
    const [posting, breadcrumbs] = await emitted(SAMPLE_JOB);

    expect(posting["@type"]).toBe("JobPosting");
    expect(checkJobPosting(posting)).toEqual([]);
    expect(breadcrumbs["@type"]).toBe("BreadcrumbList");
    expect(checkBreadcrumbList(breadcrumbs)).toEqual([]);
  });

  it("emits no JobPosting at all when the row cannot fill Google's required set", async () => {
    const blocks = await emitted(MINIMAL_JOB);

    expect(blocks.map((block) => block["@type"])).toEqual(["BreadcrumbList"]);
  });
});
