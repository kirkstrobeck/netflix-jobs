import { act, cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UltraText } from "@/app/_ultra/ultra-text";

const WORD = "Be part of what’s next";

const lines = vi.fn(() => [] as { text: string; x: number; y: number }[]);
const painting = { on: undefined as ((value: boolean) => void) | undefined };

vi.mock("@/app/_ultra/use-glyph-lines", () => ({
  useGlyphLines: () => lines(),
}));

// The real canvas needs WebGPU to report anything. This one hands the switch
// back, so the test decides when the fill is painting.
vi.mock("@/app/_ultra/ultra-fill-canvas", () => ({
  UltraFillCanvas: ({
    onPainting,
    className,
    style,
  }: {
    onPainting: (value: boolean) => void;
    className: string;
    style: Record<string, string>;
  }) => {
    painting.on = onPainting;

    return <canvas className={`ultra-fill ${className}`} style={style} />;
  },
}));

beforeEach(() => {
  lines.mockReturnValue([]);
});

afterEach(cleanup);

describe("UltraText", () => {
  /**
   * The canvas is decoration; this is the headline. A crawler, a reader mode, a
   * visitor with JavaScript off and a visitor with no WebGPU all get an h1
   * carrying the words, with the class that sets its type still on that h1
   * rather than on a wrapper.
   */
  it("is an h1 with real text in it, under its own type class", () => {
    const html = renderToStaticMarkup(
      <UltraText as="h1" className="masthead__title">
        {WORD}
      </UltraText>,
    );

    expect(html).toContain('<h1 class="ultra masthead__title">');
    expect(html).toContain(`<span class="ultra__ink">${WORD}</span>`);
  });

  /**
   * The server render measures nothing -- there is no layout to measure -- so
   * the mask is empty and the headline is not lit. That ordering is the whole
   * safety of the technique: `data-ultra` is what takes the ink away, so text
   * under an empty mask can never be an invisible headline.
   */
  it("is not lit until there is both a mask and a fill", () => {
    const html = renderToStaticMarkup(
      <UltraText className="job-title">{WORD}</UltraText>,
    );

    expect(html).not.toContain("data-ultra=");
    expect(html).not.toContain("<text");
  });

  it("lights up once the fill paints and the lines are measured", () => {
    lines.mockReturnValue([{ text: "Be part of", x: 4, y: 40 }]);
    const { container } = render(
      <UltraText as="h1" className="job-title">
        {WORD}
      </UltraText>,
    );

    expect(container.querySelector("h1")?.dataset.ultra).toBeUndefined();

    act(() => painting.on?.(true));

    expect(container.querySelector("h1")?.dataset.ultra).toBe("on");
  });

  // Measured lines with nothing painting them is the same non-answer as a fill
  // with no mask: either way the words keep their ink.
  it("stays unlit when the fill cannot paint", () => {
    lines.mockReturnValue([{ text: "Be part of", x: 4, y: 40 }]);
    const { container } = render(
      <UltraText className="job-title">{WORD}</UltraText>,
    );

    act(() => painting.on?.(false));

    expect(container.querySelector("h1")?.dataset.ultra).toBeUndefined();
  });

  /**
   * One <text> per line, at the line's own baseline, stating no typography: they
   * are children of the h1, so they inherit the family, size, weight, tracking
   * and casing of the words they cover. A <foreignObject> is the obvious way to
   * hold wrapped text and paints nothing at all inside a <mask> -- measured; see
   * glyph-lines.ts.
   */
  it("masks with one text per measured line, and no type of its own", () => {
    lines.mockReturnValue([
      { text: "Be part of", x: 4, y: 40 },
      { text: "what’s next", x: 4, y: 120 },
    ]);
    const { container } = render(
      <UltraText className="masthead__title">{WORD}</UltraText>,
    );
    const texts = [...container.querySelectorAll(".ultra__mask text")];

    expect(texts.map((text) => text.textContent)).toEqual([
      "Be part of",
      "what’s next",
    ]);
    expect(texts.map((text) => text.getAttribute("y"))).toEqual(["40", "120"]);
    expect(container.querySelector("foreignObject")).toBeNull();
    expect(texts[0].getAttribute("class")).toBeNull();
  });

  /**
   * url(#...) is CSS, and a colon in the id makes it an invalid selector -- so
   * the mask silently does not apply and the canvas paints as a rectangle over
   * the whole headline. React's useId() contains colons.
   */
  it("gives the mask a css-safe id, and points the canvas at it", () => {
    const html = renderToStaticMarkup(
      <UltraText className="job-title">{WORD}</UltraText>,
    );
    const id = /<mask id="([^"]+)"/.exec(html)?.[1];

    expect(id).toMatch(/^ultra-[a-zA-Z0-9]+$/);
    expect(html).toContain(`mask:url(#${id})`);
    expect(html).toContain(`-webkit-mask:url(#${id})`);
  });

  // Two headlines mean two masks, or one of them wins both -- and a mask sized
  // to the other headline is a clipped word.
  it("gives two headlines two ids", () => {
    const html = renderToStaticMarkup(
      <>
        <UltraText className="job-title">One</UltraText>
        <UltraText className="job-title">Two</UltraText>
      </>,
    );
    const ids = [...html.matchAll(/<mask id="([^"]+)"/g)].map((match) => match[1]);

    expect(new Set(ids).size).toBe(2);
  });

  // The mask sits over the words, and is not a thing to read or point at.
  it("keeps the decoration out of the pointer's and the reader's way", () => {
    const html = renderToStaticMarkup(
      <UltraText className="job-title">{WORD}</UltraText>,
    );

    expect(html).toContain('<svg aria-hidden="true" class="ultra__mask">');
  });
});
