import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobDescription } from "@/app/(site)/jobs/[jobid]/job-description";

describe("JobDescription", () => {
  it("sanitizes a script tag out of the crawled html", () => {
    const html = renderToStaticMarkup(
      <JobDescription html="<p>Safe copy</p><script>alert('xss')</script>" />,
    );

    expect(html).toContain("Safe copy");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
  });

  it("renders the section heading", () => {
    const html = renderToStaticMarkup(<JobDescription html="<p>Role</p>" />);

    expect(html).toContain("About the role");
    expect(html).toContain('id="job-description-heading"');
  });
});
