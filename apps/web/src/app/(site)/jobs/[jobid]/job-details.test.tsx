import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobDetails } from "@/app/(site)/jobs/[jobid]/job-details";
import { SITES } from "@/lib/jobs/job-summary.fixture";
import { MINIMAL_JOB, SAMPLE_JOB } from "@/lib/jobs/job.fixture";

const details = (job = SAMPLE_JOB) =>
  renderToStaticMarkup(<JobDetails catalog={SITES} job={job} />);

// The href a value links to, by the words in the link.
function hrefFor(html: string, label: string): string | null {
  const match = html.match(
    new RegExp(`<a class="detail-list__link" href="([^"]*)">${label}<`),
  );

  return match ? match[1].replaceAll("&amp;", "&") : null;
}

describe("JobDetails", () => {
  it("labels the row Locations (plural) when there is more than one", () => {
    const html = details();

    expect(html).toContain("Locations");
    // The site record's words, not the crawl's. 'Los Angeles,California,United
    // States of America' is one of five spellings of this office and matches no
    // facet; the slug it resolves to is what the listing filters on, so the
    // slug's display name is what the link says.
    expect(html).toContain("Los Angeles, California, United States");
    expect(html).toContain("Remote, United States");
  });

  it("uses the singular Location label when there is at most one", () => {
    expect(details(MINIMAL_JOB)).toContain(
      '<dt class="detail-list__term">Location</dt>',
    );
  });

  it("falls back to position_id when display_job_id is missing", () => {
    expect(details(MINIMAL_JOB)).toContain(String(MINIMAL_JOB.position_id));
  });

  it("shows Not listed for every missing optional column", () => {
    const html = details(MINIMAL_JOB);

    expect(html.match(/Not listed/g)?.length).toBe(4);
    expect(html).toContain(">Netflix<");
  });
});

// Real anchors with real hrefs. Nothing here is a click handler, so all of it
// works with JavaScript off, middle-clicks to a new tab and copies as an
// address -- and a test that reads the href is testing the thing that does the
// work rather than a stand-in for it.
describe("values that are also filters", () => {
  it("links the team, the business unit and the work type to that one filter", () => {
    const html = details();

    expect(hrefFor(html, "Developer Platform")).toBe("/?team=Developer+Platform");
    expect(hrefFor(html, "Product Engineering")).toBe("/?unit=Product+Engineering");
    expect(hrefFor(html, "Full-time")).toBe("/?type=Full-time");
  });

  // Location is asked at two depths and the link picks the deeper one -- but
  // only where the panel draws it. The US has several offices in the fixture
  // catalog, so the office is nested under the country and can be unticked.
  it("links a location to its country and its office", () => {
    expect(hrefFor(details(), "Los Angeles, California, United States")).toBe(
      "/?country=US&site=us-los-angeles",
    );
  });

  // Japan holds one office in the fixture catalog, so the country facet never
  // nests it -- a ?site= there would be a filter whose only control is off
  // screen. It also returns the identical rows, since every Japanese posting is
  // at that office, so nothing is lost by naming the country alone.
  it("names only the country when that country has a single office", () => {
    const tokyo = { ...SAMPLE_JOB, sites: ["jp-tokyo"] };

    expect(hrefFor(details(tokyo), "Tokyo, Japan")).toBe("/?country=JP");
  });

  // Job ID would filter to this page, and Department has no facet at all -- a
  // link to a filter that does not exist would land on the unfiltered board.
  it("leaves the values that are not filters as text", () => {
    const html = details();

    expect(hrefFor(html, "Engineering")).toBeNull();
    expect(hrefFor(html, "JR73020")).toBeNull();
  });

  // job.team is null here, so the Team row shows the department as a fallback
  // -- and the department is not a value the team facet holds. Linking it would
  // send the visitor to a filter matching no postings.
  it("does not link a fallback value", () => {
    const fallback = { ...MINIMAL_JOB, department: "Engineering" };

    expect(hrefFor(details(fallback), "Engineering")).toBeNull();
  });

  // A place with no row in job_locations cannot be resolved to anywhere, so the
  // crawl's own string is printed and nothing tries to link it.
  it("prints an unresolvable location instead of linking it", () => {
    const unknown = { ...SAMPLE_JOB, sites: [] };
    const html = details(unknown);

    expect(html).toContain("Los Angeles, California, United States of America");
    expect(html).not.toContain("detail-list__link\" href=\"/?country=");
  });

  // Two adjacent links with only a margin between them are one run of text to a
  // screen reader and to anything that copies the line. Asserted against the
  // markup with its tags stripped, which is what both of those see.
  it("separates two places with a character, not a gap", () => {
    const copied = details().replace(/<[^>]*>/g, "");

    expect(copied).toContain(" · ");
    expect(copied).not.toContain("StatesRemote");
  });

  // "Streaming" in a screen reader's list of links says nothing about where it
  // goes. The hidden noun is the same idiom the facet options use.
  it("gives each link a name that says what it opens", () => {
    expect(details()).toContain(
      'Full-time<span class="visually-hidden"> roles</span>',
    );
  });
});
