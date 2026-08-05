import { JobMissing } from "@/app/jobs/job-missing";

// State 2 of 2: the address cannot be a job code at all -- a hyphen, no digits,
// nothing but digits.
//
// This copy makes a stronger statement than state 1 on purpose, and it is the
// one statement here that is provable without knowing anything about Netflix's
// history: a string with punctuation or without digits fails the format outright,
// so no posting could ever have carried it. Absence from our data is not the
// evidence -- the shape is.
//
// The string the visitor typed is deliberately NOT echoed back. Reflecting raw
// path input into the document is the shape of a reflected-XSS bug even when the
// framework escapes it, and it would render whatever slur someone puts in the
// URL. Describing the expected format is more useful anyway: it tells the
// visitor what a real address looks like instead of repeating their typo.
export default function InvalidJobIdNotFound() {
  return (
    <JobMissing
      title="Not a valid job ID — Netflix Jobs"
      headline="That is not a valid job ID"
    >
      Netflix job IDs are letters followed by digits, like JR41912 or AJRT30201.
      This address is not one, so it has never been a posting.
    </JobMissing>
  );
}
