import { act } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { vi } from "vitest";

/**
 * A stand-in for the pairing the client listing rests on.
 *
 * Next patches history.pushState so that useSearchParams holds the pushed URL,
 * and restores the same way on popstate. The stack below is a real one -- push
 * truncates the forward entries, back walks the cursor -- so "the URL fully
 * restores state" is tested against something that can actually get it wrong.
 *
 * It lives in its own module because two suites need it: the one about
 * filtering and paging, and the one about the detected country surviving a
 * Back button. A second copy of a history stack is a second thing to get
 * subtly different.
 */
const listeners = new Set<() => void>();

let stack = ["/"];
let cursor = 0;

export const url = () => stack[cursor];

const announce = () => listeners.forEach((notify) => notify());

/** The router's own push, for the before-the-board-arrives path. */
export const push = vi.fn();

export const pushState = vi.fn((_state: unknown, _title: string, next: string) => {
  stack = [...stack.slice(0, cursor + 1), next];
  cursor += 1;
  announce();
});

/** Back (-1) and forward (+1), as a popstate the subscribers actually see. */
export const travel = async (step: number) => {
  await act(async () => {
    cursor += step;
    announce();
  });
};

/** Start again, optionally somewhere other than the bare listing. */
export function resetHistory(at = "/"): void {
  stack = [at];
  cursor = 0;
  push.mockClear();
  pushState.mockClear();
}

// Hoisted above the imports by vi.mock, so it is reached through a dynamic
// import inside the factory rather than through a binding at the top.
export function navigationMock() {
  return {
    useRouter: () => ({ push }),
    useSearchParams: () =>
      new URLSearchParams(
        // No server snapshot: these suites mount into jsdom, never through
        // renderToStaticMarkup, so a third argument here would be a branch
        // nothing can reach.
        useSyncExternalStore(
          (notify: () => void) => {
            listeners.add(notify);
            return () => listeners.delete(notify);
          },
          // Parsed rather than split on "?", because a page link ends in
          // `#open-roles` and a naive split hands the fragment to the last
          // param as part of its value. The real useSearchParams never sees a
          // fragment -- it is not sent to a server and is not query state --
          // so neither does this.
          () => new URL(url(), "https://jobs.example").search.slice(1),
        ),
      ),
  };
}
