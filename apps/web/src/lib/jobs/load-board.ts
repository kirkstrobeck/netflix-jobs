import "server-only";

import type { Board } from "@/lib/jobs/board";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { listSites } from "@/lib/jobs/list-sites";

/**
 * The postings and the site table they point at, as one value.
 *
 * No `use cache` of its own: both halves are already cached under the same tag
 * and the same profile, and a third entry would be a second copy of bytes that
 * are already in the first two. This is the composition, not a cache.
 *
 * It has its own module rather than living beside boardBody because it has two
 * callers that want different things from it -- the route handler serialises
 * it, the listing filters it -- and neither should have to reach through the
 * other to get it.
 */
export async function loadBoard(): Promise<Board> {
  const [sites, jobs] = await Promise.all([listSites(), listJobSummaries()]);

  return { sites, jobs };
}
