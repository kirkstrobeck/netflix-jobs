import { describe, expect, it } from "vitest";

import { escapeAttribute, renderAttributes } from "@/lib/html/attributes";

describe("escapeAttribute", () => {
  it("escapes ampersands, quotes, and angle brackets", () => {
    expect(escapeAttribute(`&"<>`)).toBe("&amp;&quot;&lt;&gt;");
  });
});

describe("renderAttributes", () => {
  it("returns an empty string for non-a tags", () => {
    expect(renderAttributes("p", ` href="http://example.com"`)).toBe("");
  });

  it("returns an empty string when there is no href", () => {
    expect(renderAttributes("a", ` class="x"`)).toBe("");
  });

  it.each([
    ["http://example.com"],
    ["https://example.com"],
    ["mailto:jobs@netflix.com"],
    ["tel:+15555550123"],
    ["/jobs/JR41912"],
    ["#section"],
  ])("accepts a safe href: %s", (href) => {
    const result = renderAttributes("a", ` href="${href}"`);
    expect(result).toContain(`href="${href}"`);
  });

  it("rejects a javascript: href", () => {
    expect(renderAttributes("a", ` href="javascript:alert(1)"`)).toBe("");
  });

  it("rejects a decimal entity-encoded javascript: href", () => {
    expect(renderAttributes("a", ` href="&#106;avascript:alert(1)"`)).toBe("");
  });

  it("rejects a hex entity-encoded javascript: href", () => {
    expect(renderAttributes("a", ` href="&#x6a;avascript:alert(1)"`)).toBe("");
  });

  // Both entity forms decode to code point 0 via the `|| 0` fallback, and the
  // NUL that produces is then stripped as a control character.
  it("decodes a hex entity that resolves to code point zero", () => {
    expect(renderAttributes("a", ` href="http://exa&#x0;mple.com"`)).toContain(
      'href="http://example.com"',
    );
  });

  it("decodes a decimal entity that resolves to code point zero", () => {
    expect(renderAttributes("a", ` href="http://exa&#0;mple.com"`)).toContain(
      'href="http://example.com"',
    );
  });

  it("decodes named entities before checking the scheme", () => {
    const result = renderAttributes("a", ` href="http://example.com/?a=1&amp;b=2"`);
    expect(result).toContain("http://example.com/?a=1&amp;b=2");
  });

  it("leaves an unrecognized named entity untouched", () => {
    const result = renderAttributes("a", ` href="http://example.com/?a&unknown;"`);
    expect(result).toContain("http://example.com/?a&amp;unknown;");
  });

  it("reads a double-quoted href", () => {
    expect(renderAttributes("a", ` href="http://example.com"`)).toContain(
      'href="http://example.com"',
    );
  });

  it("reads a single-quoted href", () => {
    expect(renderAttributes("a", ` href='http://example.com'`)).toContain(
      'href="http://example.com"',
    );
  });

  it("reads an unquoted href", () => {
    expect(renderAttributes("a", ` href=http://example.com`)).toContain(
      'href="http://example.com"',
    );
  });

  it("always adds target and rel", () => {
    const result = renderAttributes("a", ` href="http://example.com"`);
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer nofollow"');
  });
});
