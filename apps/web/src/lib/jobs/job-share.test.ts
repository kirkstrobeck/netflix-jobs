import { describe, expect, it } from "vitest";

import { MINIMAL_JOB, SAMPLE_JOB } from "@/lib/jobs/job.fixture";
import { jobShare } from "@/lib/jobs/job-share";

describe("what gets handed to the share sheet", () => {
  /**
   * The URL is the one thing here that cannot be got wrong quietly. Sharing the
   * page's own address would forward whatever query the referring listing left
   * on it -- ?utm_source= survives every redirect in proxy.ts deliberately --
   * and would point at the mirror rather than at what the page itself declares
   * canonical.
   */
  it("shares the canonical url, which is the one the page declares", () => {
    expect(jobShare(SAMPLE_JOB).url).toBe(SAMPLE_JOB.canonical_url);
  });

  it("names the role and where it is, in one self-contained line", () => {
    const share = jobShare(SAMPLE_JOB);

    expect(share.title).toBe(SAMPLE_JOB.title);
    expect(share.text).toBe(
      "Senior Software Engineer, Platform at Netflix, " +
        "Los Angeles, California, United States of America · " +
        "Remote, United States of America.",
    );
  });

  // A posting with nothing in `locations` must not produce a dangling comma.
  it("drops the place when there is not one", () => {
    expect(jobShare(MINIMAL_JOB).text).toBe(
      "Support Specialist at Netflix.",
    );
  });
});
