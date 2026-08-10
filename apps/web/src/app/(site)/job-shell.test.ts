import { describe, expect, it } from "vitest";

import { readCss as read, rule } from "@/app/(site)/css-rule";

const shell = read("job-shell.css");
const listing = read("_listing/jobs-listing.css");
const facets = read("_listing/jobs-facets.css");
const options = read("_listing/jobs-options.css");

/**
 * .shell is a grid item, and CSS Box Alignment says an auto margin absorbs free
 * space instead of the item being stretched. So margin-inline: auto silently
 * opted every .shell out of stretching and left it shrink-wrapped: the listing
 * was full width at 481 results and one sentence wide at none, and the masthead
 * sized to its wordmark. The width is what puts it back.
 */
describe("page width stability", () => {
  it("gives the shell a width so its auto margins cannot shrink-wrap it", () => {
    const body = rule(shell, ".shell");

    expect(body).toContain("inline-size: 100%");
    expect(body).toContain("margin-inline: auto");
    expect(body).toContain("max-inline-size: 76rem");
  });

  // An implicit auto track takes its minimum from the widest thing in it, so a
  // long unbroken string could push a min-content floor out through the page.
  it("states the page grid's single column with a zero minimum", () => {
    expect(rule(shell, ".job-page")).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  // minmax(0, 1fr), not 1fr: a bare 1fr has an auto minimum, so one long
  // unbroken result title would widen the column past its share.
  it("keeps the results column from being floored by its content", () => {
    expect(listing).toContain("grid-template-columns: minmax(0, 1fr) 19rem");
    expect(rule(listing, ".listing__body")).toContain("display: grid");
  });

  // Nothing to show is still a column, not a shelf.
  it("holds the empty state open", () => {
    expect(rule(listing, ".results-empty")).toContain("min-block-size");
  });
});

/**
 * overflow-y: auto computes the visible axis to auto as well, which made the
 * panel a scroll container on both axes and clipped the search input's
 * 3px-offset focus ring at its left and right edges -- leaving a bar above and
 * below the field. Nothing in the panel scrolls now.
 */
describe("no scrolling in the filters", () => {
  it("leaves no scroll container in the panel or its lists", () => {
    expect(facets).not.toContain("overflow");
    expect(options).not.toContain("overflow-y");
    expect(rule(options, ".facet__options")).not.toContain("max-block-size");
  });

  it("does not stick the panel either", () => {
    expect(facets).not.toContain("position: sticky");
  });

  // The shared .job-page :focus-visible ring is the whole focus state.
  it("adds no second focus treatment on the search inputs", () => {
    expect(facets).not.toContain(".facet__search:focus-visible");
  });
});

// One rule per case rather than one blanket declaration: balance evens the lines
// of short display text, pretty rescues a stranded last word in running text.
describe("line balancing", () => {
  it("balances short display strings", () => {
    expect(rule(read("home-masthead.css"), ".masthead__title")).toContain(
      "text-wrap: balance",
    );
    expect(rule(read("_listing/result-row.css"), ".result__title")).toContain(
      "text-wrap: balance",
    );
    expect(rule(options, ".option__label")).toContain("text-wrap: balance");
  });

  // The result row's own case for pretty was the joined location list, which is
  // running text of unpredictable length. The row is one title and one date now,
  // and neither is prose, so the empty state carries this on its own.
  it("uses pretty for running copy, where balance would even out prose", () => {
    expect(rule(listing, ".results-empty__hint")).toContain("text-wrap: pretty");
    expect(rule(listing, ".results-empty__lede")).toContain("text-wrap: pretty");
  });

  // A 19rem column and one unbreakable string would otherwise push through it.
  it("lets a long unbroken option label break", () => {
    expect(rule(options, ".option__label")).toContain("overflow-wrap: break-word");
  });
});

/**
 * THE CLAUSE THAT USED TO ARRIVE AFTER PAINT.
 *
 * A fetch of the request's country landed one into the results heading seconds
 * after the page, in a clause of its own. This label shares its line with the
 * sort control, so it is 134px wide at a 320px viewport -- measured against the
 * running page -- and "Open roles — you are in the United States" (387px) was
 * three lines there, which is why the stylesheet hid it below 42rem.
 *
 * The clause was removed from the copy: the URL already carries the country and
 * the facets panel already shows it ticked. The rule that hid it went with it,
 * then the fetch itself did, and this test is what keeps a heading that can
 * grow a line after paint from coming back with any of them.
 */
describe("a heading that cannot move the page", () => {
  it("has no after-paint clause left to hide", () => {
    expect(listing).not.toContain(".listing-title__where");
  });
});
