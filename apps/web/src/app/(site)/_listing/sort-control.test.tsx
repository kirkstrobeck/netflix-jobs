import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
