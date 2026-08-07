import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import JobNotFound from "@/app/(site)/jobs/[jobid]/not-found";

describe("JobNotFound", () => {
  it("states the absence in both the heading and the tab title", () => {
    const html = renderToStaticMarkup(<JobNotFound />);

    expect(html).toContain("No open role with that ID");
    expect(html).toContain("<title>No open role with that ID — Netflix Jobs</title>");
  });

  it("links back to the home page", () => {
    const html = renderToStaticMarkup(<JobNotFound />);

    expect(html).toContain('href="/"');
    expect(html).toContain("Back to Netflix Jobs");
  });

  it("never echoes a raw jobid segment back into the page", () => {
    const html = renderToStaticMarkup(<JobNotFound />);

    expect(html).not.toMatch(/jobid/i);
    expect(html).not.toContain("undefined");
  });
});
