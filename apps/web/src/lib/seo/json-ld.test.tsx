import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JsonLd } from "@/lib/seo/json-ld";
import { netflixOrganization } from "@/lib/seo/organization";

describe("JsonLd", () => {
  it("emits a script the HTML parser hands back as JSON", () => {
    const html = renderToStaticMarkup(<JsonLd data={netflixOrganization()} />);
    const inner = /<script type="application\/ld\+json">([\s\S]*)<\/script>/.exec(html)![1];

    expect(JSON.parse(inner)).toEqual(netflixOrganization());
  });

  // The reason the encoder escapes "<": a crawled description containing
  // "</script>" would otherwise close the block early and spill JSON into the
  // document as text.
  it("cannot be closed early by its own payload", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      description: "</script><img src=x>",
    } as const;

    const html = renderToStaticMarkup(<JsonLd data={data} />);

    expect(html).not.toContain("</script><img");
    expect(html.match(/<\/script>/g)).toHaveLength(1);

    const inner = /<script type="application\/ld\+json">([\s\S]*)<\/script>/.exec(html)![1];

    expect(JSON.parse(inner).description).toBe("</script><img src=x>");
  });
});
