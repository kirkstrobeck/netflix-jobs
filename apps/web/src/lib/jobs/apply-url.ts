// WHERE THE APPLY BUTTON GOES, BUILT FROM THE PID RATHER THAN STORED.
//
// This used to be a column. The ingestor synthesised
// `<board>/careers/job/<pid>/apply` and every posting stored its own copy of a
// path that Netflix does not serve -- measured 404 on 2026-08-10, on every one
// of the 478 active roles. The board's apply route is a QUERY on one fixed
// path, not a segment under the posting:
//
//   https://explore.jobs.netflix.net/careers/apply?domain=netflix.com&pid=790316842623&sort_by=relevance
//
// So the value was never data. It is a pure function of `position_id`, which is
// the table's primary key -- bigint, not null, present on every row that
// exists. Deriving it here means an active role CANNOT render a broken apply
// link, and it means the format lives in one place instead of in 478 rows that
// a re-crawl is the only way to correct.
//
// `pid` is the numeric position_id, not the JR##### code the URLs on this site
// are keyed on. Netflix's apply route does not accept the display code.
const BOARD_APPLY = "https://explore.jobs.netflix.net/careers/apply";

// domain, pid, sort_by -- in that order, because URLSearchParams preserves
// insertion order and this is the order the board itself emits. Nothing here
// needs sort_by, but it is in the URL Netflix hands out and an apply link that
// differs from theirs is a link that has to be re-proven.
export function applyUrl(positionId: number): string {
  const params = new URLSearchParams({
    domain: "netflix.com",
    pid: String(positionId),
    sort_by: "relevance",
  });

  return `${BOARD_APPLY}?${params}`;
}
