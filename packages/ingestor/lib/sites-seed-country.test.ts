import { describe, expect, it, vi } from 'vitest';

// seedRows() reads SITE_SEED, a module-level constant whose every country code
// is currently in the countries table -- so the throw for a code that is not
// was carried by a coverage-ignore comment. The guard is not dead, though: it
// is the thing that fires the day someone adds a site with a typo in its
// country. Swapping the seed for one with that typo is how you find out that
// it fails loudly instead of writing a row with an empty country name.

vi.mock('./sites-seed.ts', () => ({
  SITE_SEED: [
    {
      slug: 'atlantis',
      city: 'Atlantis',
      country: 'ZZ',
      coords: [0, 0] as [number, number],
    },
  ],
}));

describe('seedRows with a seed the countries table does not cover', () => {
  it('names the site and the code it could not resolve', async () => {
    const { seedRows } = await import('./sites.ts');

    expect(() => seedRows()).toThrowError('seed site atlantis has unknown country ZZ');
  });
});
