import { describe, expect, it } from "vitest";

import { applyUrl } from "@/lib/jobs/apply-url";
import { SAMPLE_JOB } from "@/lib/jobs/job.fixture";

// The example the owner gave, for the pid it names. Asserted whole and by
// equality rather than by parts: this is the one string on a posting's page
// that is worth nothing if it is merely close, and the previous version of it
// -- /careers/job/<pid>/apply -- was a URL that parsed, resolved, and 404'd.
const OWNER_EXAMPLE =
  "https://explore.jobs.netflix.net/careers/apply" +
  "?domain=netflix.com&pid=790316842623&sort_by=relevance";

describe("where the Apply button goes", () => {
  it("matches the board's own apply url character for character", () => {
    expect(applyUrl(790316842623)).toBe(OWNER_EXAMPLE);
  });

  it("keys on the numeric position_id, not the display code", () => {
    const href = applyUrl(SAMPLE_JOB.position_id);

    expect(href).toContain(`pid=${SAMPLE_JOB.position_id}`);
    // JR73020 is what this site's own URLs are keyed on; Netflix's apply route
    // does not accept it, so it must not leak into the outbound link.
    expect(href).not.toContain(SAMPLE_JOB.display_job_id ?? "");
  });

  it("needs nothing from the row but the key, so no active role can miss it", () => {
    // position_id is the primary key: bigint, not null. Any row the page can
    // render at all therefore has everything this function reads.
    expect(applyUrl(1)).toBe(
      "https://explore.jobs.netflix.net/careers/apply" +
        "?domain=netflix.com&pid=1&sort_by=relevance",
    );
  });
});
