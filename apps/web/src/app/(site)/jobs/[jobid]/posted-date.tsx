"use client";

import { useEffect, useState } from "react";

import { describePosting } from "@/lib/format/posted-recency";

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
// A "New" badge used to be decided here too, for the same reason. It is gone --
// twenty rows of a newest-first list all inside their first week is twenty red
// pills down the page saying the one thing the sort has already said, and the
// relative date under each title is the honest version of it. What was removed
// is the emphasis, not the fact.
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
  const [relative, setRelative] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setRelative(describePosting(iso, Date.now()));
  }, [iso]);

  // One element now, so no fragment and no markup space to keep between two
  // runs of text. That space was load-bearing while the badge sat beside the
  // date; with the badge gone there is nothing on this line but the date.
  return (
    // title keeps the full date reachable once the visible text goes relative;
    // dateTime keeps it machine-readable either way.
    <time dateTime={iso} title={absolute}>
      {relative ?? absolute}
    </time>
  );
}
