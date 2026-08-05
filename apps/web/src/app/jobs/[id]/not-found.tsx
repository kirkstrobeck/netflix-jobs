import Link from "next/link";

import "@/app/jobs/[id]/job-hero.css";
import "@/app/jobs/[id]/job-details.css";

// Rendered through notFound(), so this ships with a real 404 status rather than
// a 200 page that merely says "not found". The masthead and font come from the
// /jobs layout, which wraps this the same way it wraps a real job.
export default function JobNotFound() {
  return (
    <div className="job-missing">
      <p className="eyebrow">Error 404</p>
      <h1 className="job-title">This role is no longer open</h1>
      <p className="job-missing__body">
        The job you are looking for has been filled, closed, or never existed at
        this address.
      </p>
      <Link className="apply-button" href="/">
        Back to Netflix Jobs
      </Link>
    </div>
  );
}
