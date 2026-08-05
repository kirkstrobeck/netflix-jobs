import Link from "next/link";
import type { ReactNode } from "react";

import "@/app/jobs/[jobid]/job-hero.css";
import "@/app/jobs/[jobid]/job-details.css";

// Shared chrome for every 404 under /jobs. The two states differ only in what
// they claim happened, so the masthead, heading level, and back link live here
// once and each state supplies just its headline and its explanation. Keeping
// the wording out of this file is the point: a shell that hardcoded copy is how
// "this role is no longer open" ended up being said about strings that were
// never roles.
export function JobMissing({
  headline,
  children,
}: {
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className="job-missing">
      <p className="eyebrow">Error 404</p>
      <h1 className="job-title">{headline}</h1>
      <p className="job-missing__body">{children}</p>

      <Link className="apply-button" href="/">
        Back to Netflix Jobs
      </Link>
    </div>
  );
}
