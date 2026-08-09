import { SiteHeader } from "@/app/(site)/site-header";

/**
 * The masthead everywhere else under (site) -- today that is a job posting.
 *
 * Not a duplicate of the slot's page: it is the same <SiteHeader /> with no
 * query, because a posting has none to carry. Without this file an unmatched
 * slot renders a 404, so it is also what keeps /jobs/JR41912 a page at all.
 *
 * It reads nothing from the request, which is what leaves the posting fully
 * prerendered and its s-maxage intact.
 */
export default function HeaderDefault() {
  return <SiteHeader />;
}
