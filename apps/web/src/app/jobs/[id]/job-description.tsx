import { sanitizeHtml } from "@/lib/html/sanitize-html";

// The description arrives as HTML from the crawl. It is rebuilt through an
// allowlist before it reaches dangerouslySetInnerHTML, which is also what strips
// the source <h1> tags so this page keeps exactly one.
export function JobDescription({ html }: { html: string }) {
  return (
    <section aria-labelledby="job-description-heading" className="job-description">
      <h2 className="section-heading" id="job-description-heading">
        About the role
      </h2>

      <div
        className="job-prose"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    </section>
  );
}
