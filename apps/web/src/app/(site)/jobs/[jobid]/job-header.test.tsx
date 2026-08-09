import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobHeader } from "@/app/(site)/jobs/[jobid]/job-header";
import { SITES } from "@/lib/jobs/job-summary.fixture";
import { MINIMAL_JOB, SAMPLE_JOB } from "@/lib/jobs/job.fixture";

describe("JobHeader", () => {
  it("renders the job title and its department as the eyebrow", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={SAMPLE_JOB} />);

    expect(html).toContain(SAMPLE_JOB.title);
    expect(html).toContain(`>${SAMPLE_JOB.department}<`);
  });

  it("falls back to Netflix for the eyebrow when the department is missing", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={MINIMAL_JOB} />);

    expect(html).toContain(">Netflix<");
  });

  it("falls back to a placeholder when there is no location", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={MINIMAL_JOB} />);

    expect(html).toContain("Location to be confirmed");
  });

  // One page, one spelling of one office. The hero used to print the crawl's
  // string while the details card below it named the site record, so 'USA -
  // Remote' and 'Remote, United States' sat on the same page describing the
  // same place -- and only the second matched the facet it filters on.
  it("names a place the way the details card and the facet do", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={SAMPLE_JOB} />);

    expect(html).toContain("Los Angeles, California, United States · Remote, United States");
    expect(html).not.toContain("United States of America");
  });

  // Text, not links. This band sits directly above the page's one primary
  // action, and three underlined facts beside Apply is three invitations to
  // leave. The card below is where a value being a filter is useful.
  it("leaves the hero facts unlinked", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={SAMPLE_JOB} />);
    const facts = html.slice(html.indexOf("job-facts"), html.indexOf("job-cta"));

    expect(facts).not.toContain("<a ");
  });

  it("renders the posted date inside a time element", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={SAMPLE_JOB} />);

    expect(html).toContain("Posted");
    expect(html).toContain("<time");
  });

  // The bars are the masthead's backdrop, so the stage has to BE the <header>
  // -- nested inside it, the hero's padding-block would be left bare.
  it("makes the masthead itself the bars stage, with the content above it", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={SAMPLE_JOB} />);

    expect(html).toContain('<header class="bars-stage job-hero">');
    expect(html).toContain('class="bars"');
    expect(html).toContain('class="bars-stage__content"');
    // Title inside the lifted content layer, not adrift beside the backdrop.
    expect(html.indexOf('class="bars-stage__content"')).toBeLessThan(
      html.indexOf(SAMPLE_JOB.title),
    );
  });

  it("shows a fallback message when the posted date is empty", () => {
    const html = renderToStaticMarkup(<JobHeader catalog={SITES} job={MINIMAL_JOB} />);

    expect(html).toContain("Posted date not listed");
    expect(html).not.toContain("<time");
  });
});
