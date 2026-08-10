import { cleanup, render } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGlyphLines } from "@/app/_ultra/use-glyph-lines";

const glyphLines = vi.fn(() => [{ text: "one", x: 0, y: 10 }]);

vi.mock("@/lib/ultra/glyph-lines", () => ({
  glyphLines: (...args: unknown[]) => glyphLines(...(args as [])),
}));

function Probe({
  ink,
  host,
  text = "one",
}: {
  ink: RefObject<HTMLElement | null>;
  host: RefObject<HTMLElement | null>;
  text?: string;
}) {
  return <output>{useGlyphLines(ink, host, text).length}</output>;
}

// Both refs pointing at real elements: the ordinary case.
function refs() {
  const ink = createRef<HTMLElement>();
  const host = createRef<HTMLElement>();

  ink.current = document.createElement("span");
  host.current = document.createElement("h1");

  return { ink, host };
}

beforeEach(() => {
  glyphLines.mockClear();
});

afterEach(cleanup);

describe("useGlyphLines", () => {
  it("measures on mount", () => {
    const { ink, host } = refs();
    const { container } = render(<Probe host={host} ink={ink} />);

    expect(glyphLines).toHaveBeenCalledWith(ink.current, host.current);
    expect(container.textContent).toBe("1");
  });

  /**
   * The headline rewraps, and that is the whole reason this is measured rather
   * than declared: a mask built for two lines over a headline that now has three
   * covers two thirds of it.
   */
  it("measures again when the window resizes", () => {
    const { ink, host } = refs();

    render(<Probe host={host} ink={ink} />);
    window.dispatchEvent(new Event("resize"));

    expect(glyphLines).toHaveBeenCalledTimes(2);
  });

  it("stops measuring once the headline is gone", () => {
    const { ink, host } = refs();

    render(<Probe host={host} ink={ink} />).unmount();
    window.dispatchEvent(new Event("resize"));

    expect(glyphLines).toHaveBeenCalledTimes(1);
  });

  /**
   * next/font swaps the display face in after first paint, and every glyph moves
   * when it does -- so a mask measured against the fallback face lands on
   * nothing. jsdom has no document.fonts, which is the other branch: a browser
   * without the API measures once and is no worse off than before.
   */
  it("measures again when the webfont lands", async () => {
    const ready = Promise.resolve();
    vi.stubGlobal("document", Object.assign(document, { fonts: { ready } }));

    const { ink, host } = refs();
    render(<Probe host={host} ink={ink} />);
    await ready;

    expect(glyphLines).toHaveBeenCalledTimes(2);
    Reflect.deleteProperty(document, "fonts");
  });

  // Nothing to measure before the elements exist. The headline keeps its ink,
  // which is what an unmeasured mask has to mean.
  it("measures nothing while the refs are empty", () => {
    const empty = createRef<HTMLElement>();
    const { host } = refs();

    render(<Probe host={empty} ink={empty} />);
    render(<Probe host={empty} ink={host} />);

    expect(glyphLines).not.toHaveBeenCalled();
  });
});
