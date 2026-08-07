import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Base, { metadata, viewport } from "@/app/layout";

describe("root layout metadata", () => {
  it("exports the site-wide metadata", () => {
    expect(metadata.title).toBe("Careers at Netflix");
    expect(metadata.description).toBe("Careers at Netflix");
    expect(metadata.openGraph?.siteName).toBe("Careers at Netflix");
  });

  it("exports the viewport configuration", () => {
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.themeColor).toBe("#000000");
  });
});

describe("Base", () => {
  it("wraps the children in an html/body document with lang=en", () => {
    const html = renderToStaticMarkup(
      <Base>
        <p>hello</p>
      </Base>,
    );

    expect(html).toContain("<html");
    expect(html).toContain('lang="en"');
    expect(html).toContain("<body");
    expect(html).toContain("hello");
  });
});
