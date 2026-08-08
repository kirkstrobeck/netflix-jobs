import { ResultRow } from "@/app/(site)/jobs/result-row";
import type { JobSummary } from "@/lib/jobs/job-summary";

// The empty state is a real answer, not a missing list: it says what happened
// and where the controls that undo it are, rather than leaving a blank column.
function NoResults() {
  return (
    <div className="results-empty">
      <p className="results-empty__lede">No roles match these filters.</p>
      <p className="results-empty__hint">
        Try removing a keyword, or widening a filter in the panel beside this list.
      </p>
    </div>
  );
}

export function ResultList({ jobs }: { jobs: JobSummary[] }) {
  if (jobs.length === 0) {
    return <NoResults />;
  }

  return (
    <ol className="results">
      {jobs.map((job) => (
        <ResultRow job={job} key={job.position_id} />
      ))}
    </ol>
  );
}
