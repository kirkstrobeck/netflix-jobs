import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Glow } from "@/app/_glow/glow";
import { ORB_COUNT } from "@/app/_glow/glow-math";

describe("Glow", () => {
  it("renders a decorative shell with every orb", () => {
    const html = renderToStaticMarkup(<Glow />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="glow"');
    expect(html).toContain("<style>");
    expect(html).toContain("glow__wash");
    expect(html).toContain("glow__orbs");
    expect(html).toContain(`glow__orb--${ORB_COUNT - 1}`);
    expect(html.match(/glow__orb glow__orb--/g)?.length).toBe(ORB_COUNT);
  });
});
