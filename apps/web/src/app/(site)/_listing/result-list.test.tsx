import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ListingSkeleton } from "@/app/(site)/_listing/listing-skeleton";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { JOBS, summary } from "@/lib/jobs/job-summary.fixture";
import { PAGE_SIZE } from "@/lib/search/paginate";

describe("ResultList", () => {
  it("renders one linked row per job", () => {
    const html = renderToStaticMarkup(<ResultList jobs={JOBS} />);

    expect(html.match(/class="result"/g)).toHaveLength(5);
    expect(html).toContain('href="/jobs/JR2"');
    expect(html).toContain("Senior software engineer");
  });

  // A result is a list of facts, not a table row: no <table>, and the labels are
  // per-row captions rather than a header row.
  it("is a list, not a table", () => {
    const html = renderToStaticMarkup(<ResultList jobs={JOBS} />);

    expect(html).toContain("<ol");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<th");
  });

  // The row is the title and how old the posting is, and nothing else: team,
  // location and work type are all filters in the panel beside the list, so
  // repeating them down every row answered a question the visitor had just
  // answered themselves.
  it("carries the title and the posted date, and no other facts", () => {
    const html = renderToStaticMarkup(
      <ResultList jobs={[summary({ title: "Staff designer" })]} />,
    );

    expect(html).toContain("Staff designer");
    expect(html).toContain("Posted");
    expect(html).not.toContain("Team");
    expect(html).not.toContain("Work type");
    expect(html).not.toContain("Los Gatos");
  });

  // Hidden, not dropped: "3 days ago" on its own does not say posted, and the
  // <dt> is what makes it a named value rather than a loose date.
  it("keeps the date's name for a screen reader, off screen", () => {
    const html = renderToStaticMarkup(<ResultList jobs={[summary()]} />);

    expect(html).toContain('<dt class="visually-hidden">Posted</dt>');
  });

  it("names a missing date instead of leaving a blank", () => {
    const html = renderToStaticMarkup(
      <ResultList jobs={[summary({ posting_date: null })]} />,
    );

    expect(html.match(/Not listed/g)?.length).toBe(1);
  });

  // The posted date is the detail page's component, so relative time and the
  // absolute date in the title come with it. No badge does: there is no badge.
  it("reuses the posted-date treatment, with the absolute date in the title", () => {
    const html = renderToStaticMarkup(
      <ResultList jobs={[summary({ posting_date: "2026-01-15" })]} />,
    );

    expect(html).toContain('title="January 15, 2026"');
    // Attribute case varies with the renderer; the value is what matters.
    expect(html.toLowerCase()).toContain('datetime="2026-01-15"');
  });

  it("says so when there is nothing to show", () => {
    const html = renderToStaticMarkup(<ResultList jobs={[]} />);

    expect(html).toContain("No roles match these filters");
    expect(html).not.toContain("<ol");
  });
});

describe("ListingSkeleton", () => {
  // A placeholder announcing a page of empty rows is worse than silence.
  it("is a full page of rows and is hidden from assistive tech", () => {
    const html = renderToStaticMarkup(<ListingSkeleton />);

    expect(html.match(/result--ghost/g)).toHaveLength(PAGE_SIZE);
    expect(html).toContain('aria-hidden="true"');
  });
});