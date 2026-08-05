import { JobMissing } from "@/app/jobs/job-missing";

// State 1 of 2: the address is a well-formed job code that no open posting
// matches -- JR41911, JR99999, ZZZZ00000.
//
// What we can prove is exactly one thing: the crawl holds the currently open
// Netflix postings, and this ID is not among them. What we CANNOT see is whether
// Netflix ever issued it. JR41911 sits between two real codes and still may never
// have existed. So the headline states the absence and nothing more -- earlier
// copy here asserted the role "has been filled or closed", which is a history we
// have no record of, presented as fact.
//
// The second sentence is deliberately a maybe, not a claim: "may" is doing real
// work and must survive any future edit to this string.
//
// Rendered through notFound(), so this ships with a real 404 status rather than
// a 200 page that merely says "not found". Malformed input never reaches here --
// proxy.ts rewrites it to /jobs/invalid, where a stronger statement IS provable.
export default function JobNotFound() {
  return (
    <JobMissing
      title="No open role with that ID — Netflix Jobs"
      headline="No open role with that ID"
    >
      This ID is not among the Netflix roles currently listed as open. It may be
      a role that has since closed, or simply a mistyped ID.
    </JobMissing>
  );
}
