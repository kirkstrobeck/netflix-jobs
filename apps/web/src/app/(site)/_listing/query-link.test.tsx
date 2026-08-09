import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryLink } from "@/app/(site)/_listing/query-link";
import { NavigateProvider, useQueryNavigation } from "@/app/(site)/_listing/use-query-navigation";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

const navigate = vi.fn();
const QUERY: JobQuery = { ...EMPTY_QUERY, team: ["Engineering"], page: 3 };

beforeEach(() => navigate.mockClear());
afterEach(cleanup);

function mount(query: JobQuery = QUERY) {
  return render(
    <NavigateProvider value={navigate}>
      <QueryLink query={query}>Page 3</QueryLink>
    </NavigateProvider>,
  );
}

const link = () => screen.getByRole("link", { name: "Page 3" });

describe("QueryLink", () => {
  // The href is the whole point: it is what a crawler follows, what "copy link
  // address" copies, and what happens when there is no JavaScript.
  it("is a real anchor pointing at the server-rendered URL", () => {
    mount();

    expect(link().getAttribute("href")).toBe("/?team=Engineering&page=3");
  });

  it("filters in place on a plain click", () => {
    mount();

    fireEvent.click(link(), { button: 0 });

    expect(navigate).toHaveBeenCalledWith(QUERY);
  });

  // A modified click is the visitor talking to the BROWSER -- open in a new tab,
  // a new window, download it. Intercepting those breaks the anchor.
  it.each([
    ["command", { metaKey: true }],
    ["control", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("leaves a %s click to the browser", (_name, modifier) => {
    mount();

    fireEvent.click(link(), { button: 0, ...modifier });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("marks the current page for assistive tech", () => {
    render(
      <NavigateProvider value={navigate}>
        <QueryLink current="page" query={QUERY}>
          Page 3
        </QueryLink>
      </NavigateProvider>,
    );

    expect(link().getAttribute("aria-current")).toBe("page");
  });

  // A sort option is one item of a set, not a page. The caller says which word
  // it means and the link says exactly that, rather than one being assumed.
  it("marks the current item of a set as such", () => {
    render(
      <NavigateProvider value={navigate}>
        <QueryLink current="true" query={QUERY}>
          Nearest
        </QueryLink>
      </NavigateProvider>,
    );

    expect(
      screen.getByRole("link", { name: "Nearest" }).getAttribute("aria-current"),
    ).toBe("true");
  });
});

describe("useQueryNavigation", () => {
  // A control rendered outside the listing would push to nothing, which looks
  // like a filter that half works. Better to be impossible to miss.
  it("refuses to work outside the listing", () => {
    function Orphan() {
      useQueryNavigation();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(/inside the listing/);
  });
});
