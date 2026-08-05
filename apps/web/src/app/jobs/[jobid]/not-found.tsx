import { JobMissing } from "@/app/jobs/job-missing";

// State 1 of 2: the address is a well-formed job code -- JR99999, ZZZZ00000 --
// that no active row matches. A code of that shape plausibly WAS a posting that
// has since been filled or pulled, so saying the role closed is a fair claim.
//
// Rendered through notFound(), so this ships with a real 404 status rather than
// a 200 page that merely says "not found". The masthead and font come from the
// /jobs layout, which wraps this the same way it wraps a real job.
//
// Malformed input never reaches this file: proxy.ts rewrites it to /jobs/invalid
// so that case can state what is actually true about it, instead of being folded
// in here behind a "or never existed at this address" hedge.
export default function JobNotFound() {
  return (
    <JobMissing headline="This role is no longer open">
      The job you are looking for has been filled or closed.
    </JobMissing>
  );
}
