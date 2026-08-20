import { describe, expect, it } from 'vitest';

import { compare, formatTable } from './reingest-compare.ts';
import type { DbCounts } from './reingest-counts.ts';

const A: DbCounts = { activeRoles: 509, locationLinks: 676, rolesWithCoords: 400 };
const B: DbCounts = { activeRoles: 509, locationLinks: 676, rolesWithCoords: 400 };
const DIFF: DbCounts = { activeRoles: 500, locationLinks: 650, rolesWithCoords: 390 };

describe('compare', () => {
  it('returns agree true when all three counts match', () => {
    expect(compare(A, B).agree).toBe(true);
  });

  it('returns agree false when activeRoles differ', () => {
    expect(compare(A, { ...B, activeRoles: 500 }).agree).toBe(false);
  });

  it('returns agree false when locationLinks differ', () => {
    expect(compare(A, { ...B, locationLinks: 1 }).agree).toBe(false);
  });

  it('returns agree false when rolesWithCoords differ', () => {
    expect(compare(A, { ...B, rolesWithCoords: 1 }).agree).toBe(false);
  });

  it('includes both count objects in the verdict', () => {
    const v = compare(A, DIFF);
    expect(v.local).toBe(A);
    expect(v.hosted).toBe(DIFF);
  });
});

describe('formatTable', () => {
  it('includes AGREE when counts match', () => {
    expect(formatTable(A, B)).toContain('AGREE');
    expect(formatTable(A, B)).not.toContain('DISAGREE');
  });

  it('includes DISAGREE when counts differ', () => {
    const table = formatTable(A, DIFF);
    expect(table).toContain('DISAGREE');
    expect(table).not.toMatch(/^AGREE$/m);
  });

  it('includes all three metric labels', () => {
    const table = formatTable(A, B);
    expect(table).toContain('Active roles');
    expect(table).toContain('Location links');
    expect(table).toContain('Roles with coords');
  });

  it('includes local and hosted counts', () => {
    const table = formatTable(A, DIFF);
    expect(table).toContain('509');
    expect(table).toContain('500');
  });
});
