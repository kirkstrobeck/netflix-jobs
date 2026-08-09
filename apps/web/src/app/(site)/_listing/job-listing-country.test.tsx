import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JobListing } from "@/app/(site)/_listing/job-listing";
import { SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { boardVersion } from "@/lib/jobs/board-payload";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { listSites } from "@/lib/jobs/list-sites";
import type { RawSearchParams } from "@/lib/search/parse-query";

vi.mock("@/lib/jobs/list-jobs", () => ({ listJobSummaries: vi.fn() }));
vi.mock("@/lib/jobs/list-sites", () => ({ listSites: vi.fn() }));
vi.mock("@/lib/jobs/board-payload", () => ({ boardVersion: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The request itself. Both are async in this version of Next, and both are
// read through the REAL detect-country -- mocking that module instead would
// leave the one path this dispatch added untested at the seam it matters most.
let requestHeaders = new Headers();
let requestCookies = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: (name: string) => wrap(requestCookies.get(name)) }),
}));

const wrap = (value: string | undefined) => (value ? { value } : undefined);

vi.mocked(boardVersion).mockResolvedValue("bo4rdv3rs10n");
vi.mocked(listSites).mockResolvedValue(SITES);

// 25 postings, every one of them in the United States.
const BOARD = Array.from({ length: 25 }, (_, i) => summary({ title: `Role ${i}` }));

afterEach(() => {
  requestHeaders = new Headers();
  requestCookies = new Map();
  delete process.env.DEV_GEO_COUNTRY;
});

async function renderListing(params: RawSearchParams, jobs = BOARD) {
  vi.mocked(listJobSummaries).mockResolvedValue(jobs);

  return renderToStaticMarkup(
    await JobListing({ searchParams: Promise.resolve(params) }),
  );
}

/**
 * Country is the ONE dimension this render is allowed to vary on, so this is
 * where the rule that governs it is pinned: it applies on a first load, an
 * explicit answer in the URL always wins, and a remembered choice outranks the
 * address the request came from.
 *
 * The board here is the 25 US postings plus one in Tokyo, so the total names
 * the country without any assertion having to look at a facet: 26 roles is
 * every country, 25 is the United States, 1 is Japan.
 */
describe("the country the request is matched to", () => {
  const WORLD = [...BOARD, summary({ title: "Tokyo role", sites: ["jp-tokyo"] })];
  const render = (params: RawSearchParams) => renderListing(params, WORLD);

  it("applies the country the edge read off the address", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "JP" });

    expect(await render({})).toContain("of 1 role");
  });

  // Vercel's header is the production path; DEV_GEO_COUNTRY is the localhost
  // one, and the header outranks it so a real deployment is never overridden
  // by a stray env var that followed the build in.
  it("prefers the header over the dev override", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "JP" });
    process.env.DEV_GEO_COUNTRY = "US";

    expect(await render({})).toContain("of 1 role");
  });

  // The localhost path, and the reason any of this is reachable without an
  // edge in front of it: there is no header under `next dev`, ever.
  it("falls back to the dev override when there is no edge in front", async () => {
    process.env.DEV_GEO_COUNTRY = "JP";

    expect(await render({})).toContain("of 1 role");
  });

  it("assumes the United States when nothing says otherwise", async () => {
    expect(await render({})).toContain("of 25 roles");
  });

  // An override that is not a country code at all stands in for an edge that
  // could not place the address -- the third case, and the one that is
  // otherwise unreachable by hand.
  it("shows every country when the address could not be placed", async () => {
    process.env.DEV_GEO_COUNTRY = "none";

    expect(await render({})).toContain("of 26 roles");
  });

  // A shared link is authoritative. "Here are the Tokyo roles" must not be
  // rewritten to the recipient's own country.
  it("never overwrites a country carried in the URL", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "US" });

    expect(await render({ country: "JP" })).toContain("of 1 role");
  });

  // The one state that looks identical to a first load and is its opposite:
  // the visitor said "every country" out loud, and detection has to keep off.
  it("never overwrites an explicit everywhere", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "JP" });

    expect(await render({ country: "all" })).toContain("of 26 roles");
  });

  it("prefers a remembered choice over the address", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "JP" });
    requestCookies.set("nfj_country", "US");

    expect(await render({})).toContain("of 25 roles");
  });

  // A remembered "every country" is a choice too, and the one a visitor makes
  // by clicking the undo link under the note.
  it("honours a remembered everywhere", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "JP" });
    requestCookies.set("nfj_country", "all");

    expect(await render({})).toContain("of 26 roles");
  });

  /**
   * A visitor in Kenya has their address read perfectly and would land on a
   * listing of zero roles, which reads as a broken board rather than as a
   * filter. A detected country with nothing open is dropped, not applied.
   */
  it("drops a detected country that has nothing open", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "KE" });

    expect(await render({})).toContain("of 26 roles");
  });

  // A remembered country is NOT checked that way: they chose it, and a country
  // they chose with nothing open this week is a fact they are entitled to see.
  it("applies a remembered country even when it has nothing open", async () => {
    requestCookies.set("nfj_country", "KE");

    expect(await render({})).toContain("No roles match these filters");
  });

  // Only for a country that arrived on its own. One the visitor chose before
  // is their own setting coming back and needs no explanation.
  it("admits it in the panel, and only when it was detected", async () => {
    requestHeaders = new Headers({ "x-vercel-ip-country": "JP" });
    const detected = await render({});

    requestCookies.set("nfj_country", "JP");
    const remembered = await render({});

    expect(detected).toContain("Japan was matched to your location.");
    expect(remembered).not.toContain("matched to your location");
  });
});
