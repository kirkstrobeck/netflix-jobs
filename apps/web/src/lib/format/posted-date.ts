const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// posting_date is a bare `date` column. Formatting it by hand rather than with
// toLocaleDateString keeps the output identical on the server and the client:
// Date parsing would drag the runtime's timezone in and shift the day.
export function formatPostedDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!parts) {
    return null;
  }

  const month = MONTHS[Number(parts[2]) - 1];

  if (!month) {
    return null;
  }

  return `${month} ${Number(parts[3])}, ${parts[1]}`;
}
