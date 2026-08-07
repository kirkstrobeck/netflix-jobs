import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Base from "@/app/foo/page";

describe("foo prototype page", () => {
  it("renders the ambient glow", () => {
    const html = renderToStaticMarkup(<Base />);

    expect(html).toContain('class="glow"');
    expect(html).toContain('aria-hidden="true"');
  });
});
