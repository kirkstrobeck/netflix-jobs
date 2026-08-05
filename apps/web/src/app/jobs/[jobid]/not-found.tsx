import Link from "next/link";

import "@/app/jobs/[jobid]/job-hero.css";
import "@/app/jobs/[jobid]/job-details.css";

// The only 404 a job URL can produce. Every miss lands here -- a well-formed code
// with no open posting (JR41911), and junk that could never be a code
// (/jobs/FUCK-OFF) alike. The second 404 state and the proxy rewrite that fed it
// have been removed.
//
// What we can prove is exactly one thing: the crawl holds the currently open
// Netflix postings, and this ID is not among them. What we CANNOT see is whether
// Netflix ever issued it. JR41911 sits between two real codes and still may never
// have existed. So the headline states the absence and nothing more -- earlier
// copy here asserted the role "has been filled or closed", a history we have no
// record of, presented as fact. The second sentence is deliberately a maybe:
// "may" is doing real work and must survive any future edit to this string.
//
// The requested ID is never echoed into the page. Reflecting raw path input is
// the shape of a reflected-XSS bug even when the framework escapes it, and it
// would render whatever slur someone puts in the URL. That holds regardless of
// how the request was routed here.
//
// Rendered through notFound(), so this ships with a real 404 status rather than
// a 200 page that merely says "not found". The <title> is an element rather than
// a `metadata` export because a not-found.tsx cannot export metadata; React
// hoists it into <head>.
export default function JobNotFound() {
  return (
    <div className="job-missing">
      <title>No open role with that ID — Netflix Jobs</title>

      <p className="eyebrow">Error 404</p>
      <h1 className="job-title">No open role with that ID</h1>
      <p className="job-missing__body">
        This ID is not among the Netflix roles currently listed as open. It may
        be a role that has since closed, or simply a mistyped ID.
      </p>

      <Link className="apply-button" href="/">
        Back to Netflix Jobs
      </Link>
    </div>
  );
}
