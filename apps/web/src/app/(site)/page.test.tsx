import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "@/app/(site)/page";

describe("Home", () => {
  it("renders a visually-hidden h1 naming the page", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("<h1");
    expect(html).toContain('class="visually-hidden"');
    expect(html).toContain("Careers at Netflix");
  });
});
