import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Base, { metadata, viewport } from "@/app/layout";

describe("root layout metadata", () => {
  it("exports the site-wide metadata", () => {
    expect(metadata.title).toBe("Careers at Netflix");
    expect(metadata.description).toBe("Careers at Netflix");
    expect(metadata.openGraph?.siteName).toBe("Careers at Netflix");
  });

  // The share preview is defined once here and inherited by every route, so this
  // is the only place it can be asserted. Absolute is the whole point: a crawler
  // rendering the card has no document origin to resolve a relative path against.
  it("carries one absolute share preview on both og and twitter", () => {
    const [og] = [metadata.openGraph?.images].flat();
    const [tw] = [metadata.twitter?.images].flat();

    expect(og).toEqual({
      url: "http://localhost:3000/share-preview.jpg",
      width: 1200,
      height: 675,
      alt: "The Netflix wordmark in red above the word JOBS in white, on a black-to-red gradient",
    });
    expect(tw).toEqual(og);
  });

  // summary_large_image, not summary: the file is 16:9 and the small card would
  // crop it to a square thumbnail.
  it("asks for the wide twitter card", () => {
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
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

  // THE ONE LINE THAT MAKES THE DOCUMENTS WHOLE.
  //
  // An empty-fallback boundary above <body> is the documented way to opt out of
  // the static shell (01-getting-started/08-caching.md): with no shell to send
  // early, a request blocks until the page is fully rendered. That is what lets
  // the listing await searchParams at the top of the page instead of streaming
  // the results in behind a ghost -- and a streamed-in boundary is delivered
  // out-of-order, so those results only became visible once JavaScript ran.
  //
  // The fallback must stay null. A fallback with markup in it is a shell again,
  // and the whole arrangement quietly goes back to streaming.
  it("opts out of the static shell with an empty boundary above the body", () => {
    const tree = Base({ children: null });
    const boundary = tree.props.children;

    expect(boundary.type).toBe(Suspense);
    expect(boundary.props.fallback).toBeNull();
    expect(boundary.props.children.type).toBe("body");
  });
});
