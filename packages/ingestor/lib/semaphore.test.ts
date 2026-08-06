import { describe, expect, it } from 'vitest';

import { createSemaphore } from './semaphore.ts';

type Deferred = { promise: Promise<string>; resolve: (value: string) => void };

function deferred(): Deferred {
  const box = {} as Deferred;
  box.promise = new Promise<string>((resolve) => {
    box.resolve = resolve;
  });
  return box;
}

describe('createSemaphore', () => {
  it('runs a task and returns its value', async () => {
    const gate = createSemaphore(1);
    await expect(gate.run(async () => 'done')).resolves.toBe('done');
  });

  it('never exceeds the concurrency bound', async () => {
    const gate = createSemaphore(2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const peak = { value: 0 };

    const tasks = gates.map((slot) =>
      gate.run(async () => {
        peak.value = Math.max(peak.value, gate.activeCount());
        return slot.promise;
      }),
    );

    // Only the first two may have started; the rest are queued behind them.
    await Promise.resolve();
    expect(gate.activeCount()).toBe(2);

    gates.forEach((slot, index) => slot.resolve(`task-${index}`));
    await expect(Promise.all(tasks)).resolves.toEqual([
      'task-0',
      'task-1',
      'task-2',
      'task-3',
    ]);
    expect(peak.value).toBe(2);
  });

  it('reports the active count while a task is in flight', async () => {
    const gate = createSemaphore(3);
    const slot = deferred();
    const task = gate.run(async () => slot.promise);

    await Promise.resolve();
    expect(gate.activeCount()).toBe(1);

    slot.resolve('ok');
    await task;
    expect(gate.activeCount()).toBe(0);
  });

  it('releases the slot when the task throws', async () => {
    const gate = createSemaphore(1);
    await expect(gate.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );
    expect(gate.activeCount()).toBe(0);

    // A throw must not wedge the gate: the next task still acquires.
    await expect(gate.run(async () => 'after')).resolves.toBe('after');
    expect(gate.activeCount()).toBe(0);
  });

  it('hands a freed slot to the longest-waiting task', async () => {
    const gate = createSemaphore(1);
    const order: string[] = [];
    const first = deferred();

    const a = gate.run(async () => {
      order.push('a-start');
      return first.promise;
    });
    const b = gate.run(async () => {
      order.push('b-start');
      return 'b';
    });

    await Promise.resolve();
    expect(order).toEqual(['a-start']);

    first.resolve('a');
    await Promise.all([a, b]);
    expect(order).toEqual(['a-start', 'b-start']);
  });
});
