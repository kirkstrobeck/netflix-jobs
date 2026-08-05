import { formatLocations } from "@/lib/format/location";
import type { Job } from "@/lib/jobs/types";

type Detail = { term: string; value: string };

function buildDetails(job: Job): Detail[] {
  const locations = formatLocations(job.locations, job.location);

  return [
    { term: "Team", value: job.team ?? job.department ?? "Netflix" },
    { term: "Department", value: job.department ?? "Not listed" },
    { term: "Business unit", value: job.business_unit ?? "Not listed" },
    {
      term: locations.length > 1 ? "Locations" : "Location",
      value: locations.length > 0 ? locations.join(" · ") : "Not listed",
    },
    { term: "Work type", value: job.work_type ?? "Not listed" },
    { term: "Job ID", value: job.display_job_id ?? String(job.position_id) },
  ];
}

// Every row is always rendered, with "Not listed" standing in for a null column.
// A conditional row would change the card's height between jobs; a fixed set
// keeps the layout predictable and honest about missing data.
export function JobDetails({ job }: { job: Job }) {
  return (
    <aside aria-labelledby="job-details-heading" className="job-details">
      <h2 className="section-heading section-heading--small" id="job-details-heading">
        Job details
      </h2>

      <dl className="detail-list">
        {buildDetails(job).map((detail) => (
          <div className="detail-list__row" key={detail.term}>
            <dt className="detail-list__term">{detail.term}</dt>
            <dd className="detail-list__value">{detail.value}</dd>
          </div>
        ))}
      </dl>

      <a
        className="detail-list__link"
        href={job.canonical_url}
        rel="noopener noreferrer"
        target="_blank"
      >
        View on the Netflix careers site
      </a>
    </aside>
  );
}
