import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ApplyButton } from "@/app/(site)/jobs/[jobid]/apply-button";

describe("ApplyButton", () => {
  it("links to the apply url and opens it in a new tab", () => {
    const html = renderToStaticMarkup(
      <ApplyButton href="https://explore.jobs.netflix.net/careers/job/1" title="Software Engineer" />,
    );

    expect(html).toContain('href="https://explore.jobs.netflix.net/careers/job/1"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("hides the job title from sighted users while keeping it for screen readers", () => {
    const html = renderToStaticMarkup(
      <ApplyButton href="https://explore.jobs.netflix.net/careers/job/1" title="Software Engineer" />,
    );

    expect(html).toContain('class="visually-hidden"');
    expect(html).toContain("Software Engineer");
    expect(html).toContain("Apply for this role");
  });
});
