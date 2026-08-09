import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobDescription } from "@/app/(site)/jobs/[jobid]/job-description";
import { descriptionHtml } from "@/lib/jobs/description-html";
import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { buildJobPosting } from "@/lib/seo/job-posting";

describe("descriptionHtml", () => {
  it("sanitizes and then refits the outline", () => {
    const out = descriptionHtml('<script>alert(1)</script><h1>Team</h1><p>Copy</p>');

    expect(out).toBe("<h3>Team</h3><p>Copy</p>");
  });

  // The property Google requires to be "the full description of the job in HTML
  // format" has to be the description the visitor reads. One function feeds both,
  // and this is the test that says so.
  it("is the same HTML the page renders and the JobPosting carries", () => {
    const rendered = renderToStaticMarkup(<JobDescription html={SAMPLE_JOB.description_html} />);
    const marked = buildJobPosting(SAMPLE_JOB)!.description as string;

    expect(rendered).toContain(marked);
    expect(marked).toBe(descriptionHtml(SAMPLE_JOB.description_html));
  });
});
