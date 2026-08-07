import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NewBadge } from "@/app/(site)/jobs/[jobid]/new-badge";

describe("NewBadge", () => {
  it("writes the word in sentence case and leaves the casing to CSS", () => {
    const html = renderToStaticMarkup(<NewBadge />);

    expect(html).toContain(">New<");
    expect(html).not.toContain("NEW");
  });

  it("carries the class the badge is styled through", () => {
    expect(renderToStaticMarkup(<NewBadge />)).toContain('class="posted-badge"');
  });
});
