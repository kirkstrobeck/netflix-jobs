import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readCss, rule as ruleIn } from "@/app/(site)/css-rule";
import { SortControl } from "@/app/(site)/_listing/sort-control";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

// This suite is not run with vitest's globals, so RTL's automatic cleanup is
// never registered and renders would pile up across tests.
afterEach(cleanup);

function mount(query: JobQuery, onNearest = vi.fn(), navigate = vi.fn()) {
  render(
    <NavigateProvider value={navigate}>
      <SortControl onNearest={onNearest} query={query} />
    </NavigateProvider>,
  );

  return { onNearest, navigate };
}

const option = (name: string) => screen.getByRole("link", { name });

describe("SortControl", () => {
  it("offers both orders as links with real addresses", () => {
    mount(EMPTY_QUERY);

    expect(option("Newest").getAttribute("href")).toBe("/");
    expect(option("Nearest").getAttribute("href")).toBe("/?sort=near");
  });

  it("defaults to newest", () => {
    mount(EMPTY_QUERY);

    expect(option("Newest").getAttribute("aria-current")).toBe("true");
    expect(option("Nearest").getAttribute("aria-current")).toBeNull();
  });

  it("marks nearest when that is the order", () => {
    mount({ ...EMPTY_QUERY, sort: "nearest" });

    expect(option("Nearest").getAttribute("aria-current")).toBe("true");
    expect(option("Newest").getAttribute("aria-current")).toBeNull();
  });

  // Composition: the country and the facets already in the URL come along, so a
  // sorted view is the SAME view, ordered differently.
  it("keeps the country and facets already selected", () => {
    mount({
      ...EMPTY_QUERY,
      country: ["JP"],
      site: ["jp-tokyo"],
      team: ["Engineering"],
    });

    expect(option("Nearest").getAttribute("href")).toBe(
      "/?country=JP&site=jp-tokyo&team=Engineering&sort=near",
    );
  });

  it("is a group with a name, not a heading", () => {
    mount(EMPTY_QUERY);

    expect(screen.getByRole("group", { name: "Sort" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sort" })).toBeNull();
  });
});

describe("what a press does", () => {
  // The rule, asserted at the point it is enforced: choosing Nearest is the
  // only thing in the app that reaches for the visitor's position.
  it("asks for the position only when Nearest is pressed", () => {
    const { onNearest, navigate } = mount(EMPTY_QUERY);

    fireEvent.click(option("Newest"), { button: 0 });

    expect(onNearest).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ sort: "newest" }));

    fireEvent.click(option("Nearest"), { button: 0 });

    expect(onNearest).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "nearest" }),
    );
  });

  // A modified click is the visitor asking the BROWSER to open a tab, so the
  // href is left alone -- and nothing is asked of the device for a page the
  // visitor has not looked at yet.
  it("leaves a middle or modified click to the browser", () => {
    const { onNearest, navigate } = mount(EMPTY_QUERY);

    fireEvent.click(option("Nearest"), { button: 0, metaKey: true });

    expect(onNearest).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("returns to page 1, because the rows on page 3 are different rows", () => {
    const { navigate } = mount({ ...EMPTY_QUERY, page: 3 });

    fireEvent.click(option("Nearest"), { button: 0 });

    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });
});

/**
 * The focus state, which this control did not have.
 *
 * Two anchors in a box with overflow: hidden is the easy place to get a focus
 * ring subtly wrong -- clipped by the overflow, or drawn in a colour that is
 * invisible against the fill the chosen half already carries. Both are silent
 * failures: nothing looks broken, there is just nothing to see when you tab.
 */
describe("the switcher's focus ring", () => {
  const css = readCss("_listing/jobs-sort.css");
  const rule = (selector: string) => ruleIn(css, selector);

  // A negative offset draws the ring INSIDE the border box, which is the only
  // place the container's overflow: hidden cannot clip it.
  it("is drawn inside the box, where the overflow cannot clip it", () => {
    expect(rule(".sort__options")).toContain("overflow: hidden");
    expect(rule(".sort__option:focus-visible")).toContain("outline-offset: -2px");
  });

  // An outline rather than a box-shadow, so it survives forced colours, and the
  // same 2px accent frame the result rows use.
  it("is the same mark the result rows use", () => {
    expect(rule(".sort__option:focus-visible")).toContain(
      "outline: 2px solid var(--accent)",
    );
  });

  // The chosen option is filled with --accent, so an --accent ring on it is no
  // ring at all. White is 4.79:1 on --accent, and is what its label is already
  // set in.
  it("inverts on the chosen half, which is already accent", () => {
    expect(rule('.sort__option[aria-current="true"]:focus-visible')).toContain(
      "outline-color: #fff",
    );
  });
});
