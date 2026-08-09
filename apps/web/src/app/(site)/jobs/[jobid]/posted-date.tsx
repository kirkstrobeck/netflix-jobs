"use client";

import { useEffect, useState } from "react";

import { NewBadge } from "@/app/(site)/jobs/[jobid]/new-badge";
import { describePosting, type PostingRecency } from "@/lib/format/posted-recency";

type PostedDateProps = {
  // Formatted on the server, and proven non-null there, which is what lets this
  // render without a fallback branch of its own.
  absolute: string;
  iso: string;
};

// Relative time is a function of `now`, and the server's `now` is whenever the
// page was rendered -- which, with the route cached, can be hours or days stale.
// So the server sends the absolute date and this swaps it after mount. Both
// renders start from the same markup, so there is no hydration mismatch, and a
// visitor with JavaScript off keeps a real date rather than an empty slot.
//
// The New badge is decided here for the same reason: a cached server render
// cannot know whether a posting is still inside its first week.
//
// The clock has to be read in the effect, not in render. Two lint rules meet
// here and only this shape satisfies both: react-hooks/purity rejects Date.now()
// during render, and react-hooks/set-state-in-effect rejects the setState below.
// The second is a performance rule -- it exists to stop effects that cascade a
// second render for no reason -- and that second render is the entire feature
// here, because the relative label cannot exist until there is a browser clock
// to read. useSyncExternalStore does not help: its snapshot must be
// referentially stable, so the timestamp would have to be cached outside the
// component and would then be shared by every instance and every test.
export function PostedDate({ absolute, iso }: PostedDateProps) {
  const [recency, setRecency] = useState<PostingRecency | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setRecency(describePosting(iso, Date.now()));
  }, [iso]);

  return (
    <>
      {/* title keeps the full date reachable once the visible text goes
          relative; dateTime keeps it machine-readable either way. */}
      <time dateTime={iso} title={absolute}>
        {recency ? recency.label : absolute}
      </time>
      {/* The space is in the markup for the same reason it is in the facet
          legend: without it these two runs are adjacent in the DOM and only
          .posted-badge's margin holds them apart, so the text copies and reads
          as "2 days agoNew". */}
      {recency?.isNew ? (
        <>
          {" "}
          <NewBadge />
        </>
      ) : null}
    </>
  );
}
