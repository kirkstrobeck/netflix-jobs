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
    badge: host.querySelector(".posted-badge"),
    time: host.querySelector("time") as HTMLTimeElement,
  };
}

function mountAt(iso: string, absolute = "August 3, 2026") {
  vi.spyOn(Date, "now").mockReturnValue(NOW);

  const { container } = render(<PostedDate absolute={absolute} iso={iso} />);
  const time = container.querySelector("time") as HTMLTimeElement;

  return { badge: container.querySelector(".posted-badge"), time };
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

    it("shows no badge, because staleness is not knowable server-side", () => {
      expect(renderOnServer("2026-08-03").badge).toBeNull();
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
      const { badge, time } = mountAt("not-a-date", "August 3, 2026");

      expect(time.textContent).toBe("August 3, 2026");
      expect(badge).toBeNull();
    });
  });

  describe("the New badge", () => {
    it("appears for a posting inside its first week", () => {
      expect(mountAt("2026-08-03").badge?.textContent).toBe("New");
    });

    it("still appears one day short of the boundary", () => {
      expect(mountAt("2026-07-31").badge).not.toBeNull();
    });

    it("is gone exactly on the seventh day", () => {
      const { badge, time } = mountAt("2026-07-30");

      expect(time.textContent).toBe("last week");
      expect(badge).toBeNull();
    });

    it("is gone well past the boundary", () => {
      expect(mountAt("2026-01-15").badge).toBeNull();
    });
  });
});
