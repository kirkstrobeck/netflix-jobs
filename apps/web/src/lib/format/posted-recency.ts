const MS_PER_DAY = 86_400_000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// numeric: "auto" is why 0 and 1 read as "today" and "yesterday" instead of
// "0 days ago" and "1 day ago". It costs precision at exactly one week --
// "last week", not "1 week ago" -- which is the right trade for a line whose
// job is "is this fresh", not "how many days exactly".
const RELATIVE = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

// Longest unit first, so the first threshold a gap clears is the coarsest unit
// that still describes it in whole numbers. Intl formats the number and picks
// the plural; it does not decide that 14 days is better said as 2 weeks.
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365],
  ["month", 30],
  ["week", 7],
  ["day", 1],
];

// Nothing clears a threshold at a gap of zero, so days is the floor.
const DAY: [Intl.RelativeTimeFormatUnit, number] = ["day", 1];

// NEW_POSTING_DAYS AND `isNew` ARE GONE.
//
// This module used to return a pair -- a label, and a boolean saying whether the
// posting was inside its first week -- and the boolean existed for exactly one
// reader: the red "New" badge. The badge is gone from the listing and the detail
// hero alike, so the flag, the seven-day boundary it was compared against and
// the record wrapping them had nothing left to tell anyone.
//
// The recency itself stays, in full. It is the visible label under every result
// title, and posting_date is still what the newest sort orders on.

// Whole calendar days between the posting's date and the reader's, both reduced
// to a UTC midnight so the subtraction never lands on a DST-shortened day. The
// reader's date comes from the local getters on purpose: "3 days ago" is a claim
// about their calendar, not the server's.
function daysSince(value: string, now: number): number | null {
  const parts = DATE_PATTERN.exec(value);

  if (!parts) {
    return null;
  }

  const month = Number(parts[2]);

  // Date.UTC rolls 2026-13-01 forward into 2027 rather than rejecting it, so the
  // range has to be checked before it gets there.
  if (month < 1 || month > 12) {
    return null;
  }

  const posted = Date.UTC(Number(parts[1]), month - 1, Number(parts[3]));
  const today = new Date(now);
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round((current - posted) / MS_PER_DAY);
}

function formatGap(days: number): string {
  const [unit, size] = UNITS.find(([, threshold]) => days >= threshold) ?? DAY;

  return RELATIVE.format(-Math.floor(days / size), unit);
}

// Null for input this cannot read, which is the same input formatPostedDate
// rejects -- by the time that matters the caller has already fallen back.
export function describePosting(value: string, now: number): string | null {
  const days = daysSince(value, now);

  if (days === null) {
    return null;
  }

  // A posting dated ahead of the reader's calendar day -- a timezone east of the
  // board's, or a skewed clock -- reads as today rather than "in 2 days".
  return formatGap(Math.max(days, 0));
}
