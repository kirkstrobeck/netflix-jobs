import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { BOARD } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";
import { toggleFacet } from "@/lib/search/query-edits";

// Nothing was detected and nothing was remembered, which is the panel's plain
// case. What it does with a country that WAS detected belongs to the country
// facet, and is tested in country-facet.test.tsx.
// The panel is fed the options deriveListing already counted, which is exactly
// what the real tree hands it -- server render and client render alike.
const panel = (query: JobQuery) =>
  renderToStaticMarkup(
    <NavigateProvider value={vi.fn()}>
      <FacetsPanel
        draft=""
        facets={deriveListing(BOARD, query).facets}
        onDraft={vi.fn()}
        query={query}
      />
    </NavigateProvider>,
  );

describe("FacetsPanel", () => {
  it("renders the four facets with their counts", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain("Keywords");
    expect(html).toContain("Location");
    expect(html).toContain("Team");
    expect(html).toContain("Work type");
    expect(html).toContain("Engineering");
  });

  // The group asks one question -- where is the work -- at two depths. Calling
  // the whole thing Country named only the top of it and left the offices
  // underneath looking like a second facet with its heading missing.
  it("calls the country group Location", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain(">Location");
    expect(html).not.toContain(">Country");
  });

  // The country names the countries, not a list of the offices in them: that is
  // the whole complaint. One box for the United States, not ten for its cities.
  it("names countries rather than offices at the top level", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain("United States");
    expect(html).not.toContain("Los Gatos");
  });

  // Work type, keywords, location, seniority, team, business unit: the
  // questions people arrive with, in the order they arrive with them. Work type
  // is asked for first by name, and it earns it -- two values, complete on
  // screen, and for the roles that are remote it answers half the location
  // question below it. Seniority follows location because "where" and "at what
  // level" are the pair, and it precedes team because six closed options are a
  // shorter read than thirty-odd. Business unit is last because it is the one
  // nobody arrives with; it is here so the role pages have a filter to link to
  // and a box to untick.
  // Seniority is LAST, which is the one position on this panel that was asked
  // for outright -- it is the group that answers for only 71% of the board, so
  // it is the one to reach for rather than the one to meet. See facet-groups.ts.
  it("orders the groups work type, keywords, location, team, unit, seniority", () => {
    const html = panel(EMPTY_QUERY);
    const at = (legend: string) => html.indexOf(`>${legend}`);

    expect(at("Work type")).toBeLessThan(at("Keywords"));
    expect(at("Keywords")).toBeLessThan(at("Location"));
    expect(at("Location")).toBeLessThan(at("Team"));
    expect(at("Team")).toBeLessThan(at("Business unit"));
    expect(at("Business unit")).toBeLessThan(at("Seniority"));
  });

  // And nothing sits below it.
  it("puts seniority last of all", () => {
    const html = panel(EMPTY_QUERY);
    const legends = [...html.matchAll(/class="facet__legend"[^>]*>([A-Z][a-z ]+)/g)];

    expect(legends.at(-1)?.[1]).toBe("Seniority");
  });

  /**
   * The seniority group, drawn from the same markup as every other group: a
   * fieldset, a legend, checkboxes with labels, and the selected state carried
   * on the option's class. There is no seniority component, no seniority
   * stylesheet and no seniority branch in the panel -- which is the point.
   */
  it("draws seniority as an ordinary checkbox group with readable labels", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain("Seniority");
    expect(html).toContain("Staff and principal");
    // Six rungs, five shown, one behind -- under the three-row floor, so the
    // whole ladder stands open and neither the disclosure nor the option search
    // renders. See facet-disclosure.ts.
    expect(html).not.toContain("Search seniority levels");
    expect(html).not.toContain("more seniority levels");
  });

  // Selection is markup and CSS: a ticked box and the class the stylesheet
  // reads. Nothing about it is computed at paint time or held in script.
  it("marks a selected seniority in the markup, not in a style", () => {
    const html = panel(toggleFacet(EMPTY_QUERY, "seniority", "staff"));

    expect(html).toContain("option option--on");
    expect(html).toContain(">1 selected<");
    expect(html).not.toContain("style=");
  });

  // Nothing to clear, no control offering to clear it.
  it("offers Clear all only once something is filtering", () => {
    const clean = panel(EMPTY_QUERY);
    const filtered = panel(toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    expect(clean).not.toContain("Clear all");
    expect(filtered).toContain("Clear all");
  });

  /**
   * Clear goes to a bare `/`, and the answer it stands for is written to the
   * cookie by useCountryChoice on the same click -- which is what stops the
   * next load detecting the country back on. The href carries no `country=` at
   * all, because there is no longer a word for "everywhere" in an address.
   */
  it("clears to the bare listing and names no country", () => {
    const html = panel({
      ...EMPTY_QUERY,
      country: ["US"],
      team: ["Engineering"],
      keywords: ["design"],
      page: 4,
    });

    expect(html).toContain('href="/"');
    expect(html).not.toContain("country=all");
  });

  // Everywhere is the ABSENCE of a filter. Counting it as one would put a Clear
  // all beside a listing showing every role there is.
  it("does not call an unfiltered listing filtered", () => {
    expect(panel(EMPTY_QUERY)).not.toContain("Clear all");
  });
});
