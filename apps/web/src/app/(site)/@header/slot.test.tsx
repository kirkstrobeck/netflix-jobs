import { describe, expect, it } from "vitest";

import HeaderDefault from "@/app/(site)/@header/default";
import HeaderSlot from "@/app/(site)/@header/page";
import { renderAsync } from "@/app/(site)/render-async";

describe("the masthead slot", () => {
  // The point of the slot: it is a page, so it is handed the listing's query,
  // and the mark it renders links back to the board the visitor is on.
  it("hands the listing's facets to the wordmark", async () => {
    const html = await renderAsync(
      <HeaderSlot searchParams={Promise.resolve({ country: "US", team: "Engineering" })} />,
    );

    expect(html).toContain('href="/?country=US&amp;team=Engineering"');
    expect(html).toContain('class="skip-link"');
  });

  // Everything under (site) that is not the listing -- a posting, today. It has
  // no query to carry, and asking the request for one would cost all 481
  // postings their prerender.
  it("links to the bare board where there is no listing state", async () => {
    const html = await renderAsync(<HeaderDefault />);

    expect(html).toContain('<a class="wordmark" href="/"');
    expect(html).not.toContain("/?");
  });
});
