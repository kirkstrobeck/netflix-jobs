import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostedDate } from "@/app/(site)/jobs/[jobid]/posted-date";

// Local components, so the reader's calendar day is 2026-08-06 in any timezone.
const NOW = new Date(2026, 7, 6, 12, 0, 0).getTime();

// Server markup, read back through the parser rather than string-matched. React
// emits the camelCase `dateTime` spelling verbatim; HTML attribute names are
// case-insensitive, so what matters is what the browser makes of it.
function renderOnServer(iso: string, absolute = "August 3, 2026") {
  const html = renderToStaticMarkup(<PostedDate absolute={absolute} iso={iso} />);
  const host = document.createElement("div");
  host.innerHTML = html;

  return {
    time: host.querySelector("time") as HTMLTimeElement,
  };
}

function mountAt(iso: string, absolute = "August 3, 2026") {
  vi.spyOn(Date, "now").mockReturnValue(NOW);

  const { container } = render(<PostedDate absolute={absolute} iso={iso} />);
  const time = container.querySelector("time") as HTMLTimeElement;

  return { container, time };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PostedDate", () => {
  // The server has no `now` the browser will agree with, so it renders the
  // absolute date -- which is also what a visitor with JavaScript off keeps.
  describe("before mount", () => {
    it("renders the absolute date as the visible text", () => {
      expect(renderOnServer("2026-08-03").time.textContent).toBe("August 3, 2026");
    });

    it("still carries the machine-readable date", () => {
      expect(renderOnServer("2026-08-03").time.dateTime).toBe("2026-08-03");
    });

  });

  describe("after mount", () => {
    it("swaps the visible text to relative time", () => {
      expect(mountAt("2026-08-03").time.textContent).toBe("3 days ago");
    });

    it("moves the full date into the title attribute", () => {
      expect(mountAt("2026-08-03").time.title).toBe("August 3, 2026");
    });

    it("keeps dateTime on the iso date, not the relative label", () => {
      expect(mountAt("2026-08-03").time.dateTime).toBe("2026-08-03");
    });

    it("keeps the absolute date when the iso date cannot be read", () => {
      expect(mountAt("not-a-date", "August 3, 2026").time.textContent).toBe(
        "August 3, 2026",
      );
    });
  });

  /**
   * THE BADGE THAT WAS REMOVED, PINNED SO IT CANNOT COME BACK.
   *
   * This suite used to assert the opposite: that a posting inside its first week
   * grew a red "New" pill next to its date. On a newest-first list that fired on
   * most of the page at once, which is emphasis that emphasises nothing.
   *
   * The dates that USED to be the interesting ones -- today, one day short of
   * the old boundary, exactly on it -- are the cases checked here, because they
   * are where a reintroduced badge would show up first.
   */
  describe("the New badge", () => {
    const days = ["2026-08-06", "2026-08-03", "2026-07-31", "2026-07-30", "2026-01-15"];

    it("renders nothing beside the date, at any age", () => {
      for (const iso of days) {
        expect(mountAt(iso).container.textContent).not.toContain("New");
        vi.restoreAllMocks();
      }
    });

    // The date is the only child now, so anything added beside it shows up as a
    // second element under the <dd> -- which is what this counts.
    it("renders the date and nothing else", () => {
      const html = renderToStaticMarkup(
        <PostedDate absolute="August 3, 2026" iso="2026-08-03" />,
      );

      expect(html).toBe(
        '<time dateTime="2026-08-03" title="August 3, 2026">August 3, 2026</time>',
      );
    });
  });
});
