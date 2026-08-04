// Bounded concurrency, ported from the easytopjobs pipeline.

type Waiter = () => void;

export function createSemaphore(max: number) {
  const waiters: Waiter[] = [];
  const state = { active: 0 };

  const release = (): void => {
    state.active -= 1;
    const next = waiters.shift();
    if (next) next();
  };

  const acquire = async (): Promise<void> => {
    if (state.active < max) {
      state.active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(() => {
        state.active += 1;
        resolve();
      });
    });
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };

  return { run, activeCount: () => state.active };
}
