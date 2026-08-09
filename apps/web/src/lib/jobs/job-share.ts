import { formatLocations } from "@/lib/format/location";
import type { Job } from "@/lib/jobs/types";

/**
 * What gets handed to the operating system's share sheet.
 *
 * THE URL IS THE CANONICAL ONE, NOT THE PAGE'S OWN ADDRESS
 *
 * `canonical_url` is what this page already declares in <link rel="canonical">
 * and what the JobPosting's `url` is built from -- it is the one thing in this
 * codebase called canonical, and it is Netflix's own posting. So a shared link
 * points at the posting rather than at the mirror of it, which is the address
 * that survives this site being moved, renamed or switched off.
 *
 * It also cannot pick up query junk. location.href would carry whatever the
 * referring listing left on it -- ?utm_source= survives every redirect in
 * proxy.ts on purpose -- and a campaign parameter forwarded into a friend's
 * inbox is a tracking id attributed to the wrong person.
 */
export type JobShare = {
  title: string;
  text: string;
  url: string;
};

/**
 * The text is deliberately self-contained, and deliberately repeats the title.
 *
 * Share targets do not agree on which fields they use: some show `title` and
 * `url`, some show `text` and `url`, some concatenate all three. A `text` of
 * "Los Angeles, California" is useless in the second case, so it names the role
 * and the place and stops -- one line that makes sense on its own, arriving in
 * a message thread where nobody has the page open.
 *
 * Not the description. `description_text` sliced to a length is prose cut
 * mid-word, which reads as broken in a text message even though it is fine in a
 * <meta> tag no human sees.
 */
export function jobShare(job: Job): JobShare {
  const locations = formatLocations(job.locations, job.location);
  const where = locations.length > 0 ? `, ${locations.join(" · ")}` : "";

  return {
    title: job.title,
    text: `${job.title} at Netflix${where}.`,
    url: job.canonical_url,
  };
}
