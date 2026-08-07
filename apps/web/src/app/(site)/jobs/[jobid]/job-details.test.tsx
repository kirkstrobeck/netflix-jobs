import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobDetails } from "@/app/(site)/jobs/[jobid]/job-details";
import { MINIMAL_JOB, SAMPLE_JOB } from "@/lib/jobs/job.fixture";

describe("JobDetails", () => {
  it("labels the row Locations (plural) when there is more than one", () => {
    const html = renderToStaticMarkup(<JobDetails job={SAMPLE_JOB} />);

    expect(html).toContain("Locations");
    expect(html).toContain("Los Angeles, California, United States of America");
    expect(html).toContain("Remote, United States of America");
  });

  it("uses the singular Location label when there is at most one", () => {
    const html = renderToStaticMarkup(<JobDetails job={MINIMAL_JOB} />);

    expect(html).toContain("<dt class=\"detail-list__term\">Location</dt>");
  });

  it("falls back to position_id when display_job_id is missing", () => {
    const html = renderToStaticMarkup(<JobDetails job={MINIMAL_JOB} />);

    expect(html).toContain(String(MINIMAL_JOB.position_id));
  });

  it("shows Not listed for every missing optional column", () => {
    const html = renderToStaticMarkup(<JobDetails job={MINIMAL_JOB} />);

    expect(html.match(/Not listed/g)?.length).toBe(4);
    expect(html).toContain(">Netflix<");
  });
});
