import { fitHeadingOutline } from "@/lib/html/heading-outline";
import { sanitizeHtml } from "@/lib/html/sanitize-html";

// The description exactly as the page renders it.
//
// Two passes, and the order matters. sanitizeHtml rebuilds the crawled markup
// through an allowlist; fitHeadingOutline then renumbers what is left so the
// description's own outline continues from the h2 above it instead of starting
// over. 3 is that h2's child level, which is why the job page has exactly one h1
// no matter what the crawl brought back.
//
// It lives here rather than inside JobDescription because the JobPosting's
// `description` has to be the same bytes. Google requires that property in HTML
// and requires it to match the description "job seekers can read in their
// browser"; two copies of this pipeline is the obvious way for those to drift.
export function descriptionHtml(html: string): string {
  return fitHeadingOutline(sanitizeHtml(html), 3);
}
