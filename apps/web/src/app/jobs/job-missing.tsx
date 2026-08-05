import Link from "next/link";
import type { ReactNode } from "react";

import "@/app/jobs/[jobid]/job-hero.css";
import "@/app/jobs/[jobid]/job-details.css";

// Shared chrome for every 404 under /jobs. The two states differ only in what
// they claim happened, so the masthead, heading level, and back link live here
// once and each state supplies just its title, headline, and explanation.
// Keeping the wording out of this file is the point: a shell that hardcoded copy
// is how "this role is no longer open" ended up being said about IDs we have no
// evidence were ever roles.
//
// The <title> is rendered as an element rather than exported as metadata because
// a not-found.tsx cannot export `metadata` -- React hoists this into <head>, so
// each state gets its own tab title instead of the layout's "Careers at Netflix".
export function JobMissing({
  title,
  headline,
  children,
}: {
  title: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className="job-missing">
      <title>{title}</title>

      <p className="eyebrow">Error 404</p>
      <h1 className="job-title">{headline}</h1>
      <p className="job-missing__body">{children}</p>

      <Link className="apply-button" href="/">
        Back to Netflix Jobs
      </Link>
    </div>
  );
}
