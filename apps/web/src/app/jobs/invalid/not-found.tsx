import { JobMissing } from "@/app/jobs/job-missing";

// State 2 of 2: the address cannot be a job code at all -- a hyphen, no digits,
// nothing but digits. Nothing was ever posted here, so this says so plainly
// rather than implying a role existed and closed.
//
// The string the visitor typed is deliberately NOT echoed back. Reflecting raw
// path input into the document is the shape of a reflected-XSS bug even when the
// framework escapes it, and it would render whatever slur someone puts in the
// URL. Describing the expected format is more useful anyway: it tells the
// visitor what a real address looks like instead of repeating their typo.
export default function InvalidJobIdNotFound() {
  return (
    <JobMissing headline="That is not a valid job ID">
      Netflix job IDs are letters followed by digits, like JR41912 or AJRT30201.
      This address is not one, so it has never been a posting.
    </JobMissing>
  );
}
