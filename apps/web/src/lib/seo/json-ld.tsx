import type { Thing, WithContext } from "schema-dts";

// JSON.stringify escapes nothing HTML-sensitive, and this string lands inside a
// <script> element, whose content the HTML parser reads in script data state.
// Two sequences leave that state: "</script" ends the element, and "<!--" opens
// script-data-escaped state where a later "</script>" stops closing it. A crawled
// description containing either would break the block. Escaping the "<" of just
// those two as < is exactly sufficient, and still valid JSON, so a parser
// reads the same string back.
//
// Just those two, not every "<". The JobPosting's description IS the page's
// description -- Google requires the full HTML -- so the document already
// carries it more than once, and escaping all 190-odd tag brackets made the
// JSON-LD copy six bytes per "<" longer and stopped gzip matching it against the
// copy in the article. Measured on /jobs/JR41938, gzipped: 14,529 bytes with
// every "<" escaped, 14,081 with only these two, against 13,058 for the page
// before it carried any JSON-LD at all.
function encode(data: unknown): string {
  return JSON.stringify(data).replace(/<(\/script|!--)/gi, "\\u003c$1");
}

// One <script> per entity. Google reads several blocks on a page as readily as
// one array, and separate blocks keep the failure of one from taking the other
// with it.
export function JsonLd({ data }: { data: WithContext<Thing> }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: encode(data) }}
      type="application/ld+json"
    />
  );
}
