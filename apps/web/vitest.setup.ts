import { vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/font/local", () => ({
  default: () => ({
    className: "netflix-sans",
    variable: "--font-netflix-sans",
  }),
}));

// jsdom has no IntersectionObserver, and two effects now build one on mount:
// pause-when-idle.ts parks the CSS animations off screen, and
// ultra-fill-canvas.tsx repaints an Ultra fill on re-entry. Any suite that
// renders a page containing either would throw on construction.
//
// This is a floor, not a fake with behaviour: it observes nothing and never
// fires. A test that needs the callback stubs its own -- see
// pause-when-idle.test.tsx and ultra-fill-canvas.test.tsx, both of which
// override this with vi.stubGlobal.
//
// Assigned onto globalThis rather than through vi.stubGlobal, which is the
// whole point: a suite calling vi.unstubAllGlobals() in afterEach would take a
// stubbed floor away with its own stubs and leave every later render throwing.
// This one survives that, and a per-test stub still shadows it.
Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  },
});
