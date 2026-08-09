import { descriptionHtml } from "@/lib/jobs/description-html";

// The description arrives as HTML from the crawl. It is rebuilt through an
// allowlist before it reaches dangerouslySetInnerHTML.
//
// The pipeline lives in lib/jobs/description-html.ts because the JobPosting's
// `description` property has to be these exact bytes -- Google wants the HTML
// description job seekers can read in their browser, and a second copy of the
// two passes here is how that stops being true.
export function JobDescription({ html }: { html: string }) {
  return (
    <section aria-labelledby="job-description-heading" className="job-description">
      <h2 className="section-heading" id="job-description-heading">
        About the role
      </h2>

      <div
        className="job-prose"
        dangerouslySetInnerHTML={{ __html: descriptionHtml(html) }}
      />
    </section>
  );
}
