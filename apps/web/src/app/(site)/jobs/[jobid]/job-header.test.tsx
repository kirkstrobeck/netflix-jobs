import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobHeader } from "@/app/(site)/jobs/[jobid]/job-header";
import { MINIMAL_JOB, SAMPLE_JOB } from "@/lib/jobs/job.fixture";

describe("JobHeader", () => {
  it("renders the job title and its department as the eyebrow", () => {
    const html = renderToStaticMarkup(<JobHeader job={SAMPLE_JOB} />);

    expect(html).toContain(SAMPLE_JOB.title);
    expect(html).toContain(`>${SAMPLE_JOB.department}<`);
  });

  it("falls back to Netflix for the eyebrow when the department is missing", () => {
    const html = renderToStaticMarkup(<JobHeader job={MINIMAL_JOB} />);

    expect(html).toContain(">Netflix<");
  });

  it("falls back to a placeholder when there is no location", () => {
    const html = renderToStaticMarkup(<JobHeader job={MINIMAL_JOB} />);

    expect(html).toContain("Location to be confirmed");
  });

  it("renders the posted date inside a time element", () => {
    const html = renderToStaticMarkup(<JobHeader job={SAMPLE_JOB} />);

    expect(html).toContain("Posted");
    expect(html).toContain("<time");
  });

  it("shows a fallback message when the posted date is empty", () => {
    const html = renderToStaticMarkup(<JobHeader job={MINIMAL_JOB} />);

    expect(html).toContain("Posted date not listed");
    expect(html).not.toContain("<time");
  });
});
