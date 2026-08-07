import { describe, expect, it } from "vitest";

import { sanitizeHtml } from "@/lib/html/sanitize-html";

describe("sanitizeHtml", () => {
  it("drops comments", () => {
    expect(sanitizeHtml("<!-- comment -->text")).toBe("text");
  });

  it("drops script contents", () => {
    expect(sanitizeHtml("<script>alert(1)</script>after")).toBe("after");
  });

  it("drops style contents", () => {
    expect(sanitizeHtml("<style>.x{color:red}</style>after")).toBe("after");
  });

  it("unwraps a div, keeping its text", () => {
    expect(sanitizeHtml("<div>text</div>")).toBe("text");
  });

  it("demotes an h1 to h3", () => {
    expect(sanitizeHtml("<h1>Title</h1>")).toBe("<h3>Title</h3>");
  });

  it("escapes a bare < in text", () => {
    expect(sanitizeHtml("a < b")).toBe("a &lt; b");
  });

  it("keeps a void br tag", () => {
    expect(sanitizeHtml("line one<br>line two")).toBe("line one<br>line two");
  });

  it("closes a dangling open tag", () => {
    expect(sanitizeHtml("<p>unclosed")).toBe("<p>unclosed</p>");
  });

  it("ignores a stray closing tag with no opener", () => {
    expect(sanitizeHtml("</b>text")).toBe("text");
  });

  it("tracks nested dropDepth for a dropped tag nested in itself", () => {
    expect(sanitizeHtml("<script><script>x</script>still</script>after")).toBe("after");
  });

  it("leaves output empty when a dropped tag is never closed", () => {
    expect(sanitizeHtml("<script>alert(1)")).toBe("");
  });

  it("ignores a closing tag for a dropped tag with no opener", () => {
    expect(sanitizeHtml("</script>text")).toBe("text");
  });

  it("drops a void tag that is not on the allowlist", () => {
    expect(sanitizeHtml('<img src="x">text')).toBe("text");
  });

  it("ignores a closing tag for a void element", () => {
    expect(sanitizeHtml("</br>text")).toBe("text");
  });

  it("unwinds unwrapped tags left on the stack when closing an ancestor", () => {
    expect(sanitizeHtml("<div><p>text</div>")).toBe("<p>text</p>");
  });

  it("ignores tags of a different name inside a dropped region", () => {
    expect(sanitizeHtml("<script><div>x</div>y</script>after")).toBe("after");
  });

  it("discards a dangling unwrapped tag without emitting a closer", () => {
    expect(sanitizeHtml("<div>text")).toBe("text");
  });

  it("opens an allowed tag that carries no attributes", () => {
    expect(sanitizeHtml("<p>text</p>")).toBe("<p>text</p>");
  });
});
