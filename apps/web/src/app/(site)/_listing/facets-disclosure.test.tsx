import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { readCss, rule as ruleIn } from "@/app/(site)/css-rule";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { BOARD } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

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

/**
 * The narrow-screen disclosure: markup plus CSS, and no script anywhere.
 *
 * What is pinned here is what CSS cannot recover from if it moves. The checkbox
 * has to come BEFORE the panel and be its sibling, because `:checked ~` only
 * looks forward. The label has to be bound to it by id, or the control has no
 * accessible name and no keyboard. And the panel has to exist exactly once.
 */
describe("the filters disclosure", () => {
  it("puts the switch before the panel it opens, as a sibling", () => {
    const html = panel(EMPTY_QUERY);
    const id = html.match(/class="facets__switch[^"]*" id="([^"]+)"/)?.[1];

    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html.indexOf("facets__switch")).toBeLessThan(html.indexOf("facets__panel"));
  });

  // One set of controls. A second, mobile-only copy of the panel is two sets of
  // checkboxes that have to be kept saying the same thing.
  it("renders the panel exactly once", () => {
    expect(panel(EMPTY_QUERY).match(/facets__panel/g)).toHaveLength(1);
  });

  // A shut drawer over an applied filter is an invisible filter, so the shut
  // drawer says how many. The word itself never changes -- open and shut is
  // what the checkbox announces -- so the accessible name stays put.
  it("says how many filters are applied, and only when some are", () => {
    const clean = panel(EMPTY_QUERY);
    const filtered = panel({
      ...EMPTY_QUERY,
      country: ["US"],
      team: ["Engineering"],
      keywords: ["design"],
    });

    expect(clean).not.toContain("facets__applied");
    expect(filtered).toContain(">3 applied<");
    expect(filtered).not.toContain("Show filters");
    expect(filtered).not.toContain("Hide filters");
  });

  /**
   * THE "Filters5 applied" REGRESSION.
   *
   * Two separate faults produced that one string, and both are pinned here.
   *
   * The word was in the markup TWICE -- an h2 for the wide layout and a label
   * for the narrow one, each hidden at the other's width. That is only ever one
   * stylesheet away from showing both, which is what a screenshot caught.
   *
   * And the count was glued to it, separated by nothing but a flex gap. A gap
   * is not a word separator: it does not survive text selection, it is not in
   * the accessible name, and it is not there at all before the CSS lands.
   */
  it("writes the word Filters exactly once", () => {
    expect(panel(EMPTY_QUERY).match(/>Filters/g)).toHaveLength(1);
  });

  it("separates the heading from the count in the TEXT, not in a margin", () => {
    const filtered = panel({ ...EMPTY_QUERY, country: ["US"] });
    // Everything between the word and the count, tags stripped. If the only
    // thing holding them apart is CSS, this is the empty string.
    const between = filtered
      .slice(filtered.indexOf(">Filters") + ">Filters".length)
      .split("1 applied")[0]
      .replace(/<[^>]*>/g, "");

    expect(between).toMatch(/\s/);
  });
});

/**
 * The half of it that is CSS, asserted where it is written.
 *
 * A disclosure that cannot be reached with a keyboard, or one whose focus lands
 * on a control nobody can see, fails silently: nothing looks broken, there is
 * just nothing to press and nothing to see when you tab.
 */
describe("the disclosure's CSS", () => {
  const css = readCss("_listing/jobs-collapse.css");
  const rule = (selector: string) => ruleIn(css, selector);

  it("opens the panel off the checkbox, forwards", () => {
    expect(rule(".facets__panel")).toContain("display: grid");
    expect(rule(".facets__switch:checked ~ .facets__panel")).toContain("display: grid");
  });

  // The checkbox is off screen, so the ring is drawn on the label that is not.
  it("draws focus on the label, in the page's one focus colour", () => {
    expect(rule(".facets__switch:focus-visible ~ .facets__head .facets__toggle")).toContain(
      "outline: 2px solid var(--accent)",
    );
  });

  // Nothing to toggle where the panel is always open, and nothing for a
  // keyboard to land on either.
  it("takes the switch out of the wide layout entirely", () => {
    expect(rule(".facets__switch")).toContain("display: none");
  });
});
