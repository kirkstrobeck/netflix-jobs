import { fitHeadingOutline } from "@/lib/html/heading-outline";
import { sanitizeHtml } from "@/lib/html/sanitize-html";

// Two passes, and the order matters. sanitizeHtml rebuilds the crawled markup
// through an allowlist; fitHeadingOutline then renumbers what is left so the
// description's own outline continues from the h2 above it instead of starting
// over. 3 is that h2's child level, which is why this page still has exactly one
// h1 no matter what the crawl brought back.
const prose = (html: string) => fitHeadingOutline(sanitizeHtml(html), 3);

// The description arrives as HTML from the crawl. It is rebuilt through an
// allowlist before it reaches dangerouslySetInnerHTML.
export function JobDescription({ html }: { html: string }) {
  return (
    <section aria-labelledby="job-description-heading" className="job-description">
      <h2 className="section-heading" id="job-description-heading">
        About the role
      </h2>

      <div
        className="job-prose"
        dangerouslySetInnerHTML={{ __html: prose(html) }}
      />
    </section>
  );
}
