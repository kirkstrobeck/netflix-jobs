import type { BreadcrumbList, WithContext } from "schema-dts";

import type { Job } from "@/lib/jobs/types";
import { siteUrl } from "@/lib/seo/site";

// The hierarchy is two deep and it is real: /jobs redirects to / (next.config.ts),
// so the board IS the parent of every posting, and the masthead wordmark on the
// job page is a link to it. There is no third level to invent -- team and
// department are facets of one listing, reachable at /?team=..., not pages a
// posting sits inside.
//
// Only the job page gets one. A breadcrumb on the listing would be a trail of
// length one pointing at itself.
export function buildBreadcrumbs(job: Job): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Open roles",
        item: siteUrl("/"),
      },
      {
        // The last crumb is the current page. Google's guidance is to leave its
        // `item` off -- the URL is the page the markup is on.
        "@type": "ListItem",
        position: 2,
        name: job.title,
      },
    ],
  };
}
