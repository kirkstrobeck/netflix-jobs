import { describe, expect, it } from "vitest";

import FooterDefault from "@/app/(site)/@footer/default";
import FooterSlot from "@/app/(site)/@footer/page";
import { renderAsync } from "@/app/(site)/render-async";

describe("the footer slot", () => {
  // Two slots, one component: the band at the bottom carries the same facets
  // the masthead does, because both marks are the same <Wordmark />.
  it("hands the listing's facets to the wordmark", async () => {
    const html = await renderAsync(
      <FooterSlot searchParams={Promise.resolve({ type: "Remote", page: "3" })} />,
    );

    expect(html).toContain(
      '<a class="wordmark job-footer__wordmark" href="/?type=Remote&amp;page=3"',
    );
  });

  it("links to the bare board where there is no listing state", async () => {
    const html = await renderAsync(<FooterDefault />);

    expect(html).toContain('<a class="wordmark job-footer__wordmark" href="/"');
    expect(html).not.toContain("/?");
  });
});
