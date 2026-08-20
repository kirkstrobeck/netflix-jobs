import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  findVercelToken,
  hostedCreds,
  localCreds,
  parseEnvFile,
} from './reingest-creds.ts';

const fetchMock = vi.fn();
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  (vi.mocked(existsSync) as any).mockReturnValue(false);
  (vi.mocked(readFileSync) as any).mockReturnValue('');
  vi.mocked(writeFileSync).mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe('parseEnvFile', () => {
  it('parses key=value lines', () => {
    expect(parseEnvFile('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('skips blank lines', () => {
    expect(parseEnvFile('\n\nFOO=bar\n')).toEqual({ FOO: 'bar' });
  });

  it('skips comment lines', () => {
    expect(parseEnvFile('# comment\nFOO=bar')).toEqual({ FOO: 'bar' });
  });

  it('skips lines without an equals sign', () => {
    expect(parseEnvFile('NODASH\nFOO=bar')).toEqual({ FOO: 'bar' });
  });

  it('preserves the value portion of KEY=a=b lines', () => {
    expect(parseEnvFile('URL=http://x?a=b')).toEqual({ URL: 'http://x?a=b' });
  });
});

describe('localCreds', () => {
  it('returns defaults when env vars are absent', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const c = localCreds();
    expect(c.url).toBe('http://127.0.0.1:54721');
    expect(c.serviceRoleKey).toContain('eyJ');
  });

  it('uses env vars when set', () => {
    process.env.SUPABASE_URL = 'http://custom:1234/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'my-key';
    const c = localCreds();
    expect(c.url).toBe('http://custom:1234');
    expect(c.serviceRoleKey).toBe('my-key');
  });
});

describe('findVercelToken', () => {
  it('throws when no auth file exists', () => {
    expect(() => findVercelToken()).toThrow('Vercel auth token not found');
  });

  it('falls back to /home/agent when HOME is unset', () => {
    const home = process.env.HOME;
    delete process.env.HOME;
    // existsSync returns false for both paths → throws with /home/agent in the message
    expect(() => findVercelToken()).toThrow('/home/agent');
    process.env.HOME = home;
  });

  it('returns the token from the first auth file found', () => {
    (vi.mocked(existsSync) as any).mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"tok-1"}');
    expect(findVercelToken()).toBe('tok-1');
  });

  it('skips a file that has no token and falls through to the next', () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(true)   // first path exists…
      .mockReturnValueOnce(true);  // second path exists
    (vi.mocked(readFileSync) as any)
      .mockReturnValueOnce('{}')           // …but has no token
      .mockReturnValueOnce('{"token":"tok-2"}');
    expect(findVercelToken()).toBe('tok-2');
  });

  it('skips a path that does not exist', () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false) // first path missing
      .mockReturnValueOnce(true); // second path exists
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"tok-3"}');
    expect(findVercelToken()).toBe('tok-3');
  });
});

// Helper: mock sequence for pullVercelCreds path.
// hostedCreds calls readCredsFile (1 existsSync), then pullVercelCreds calls existsSync again
// to read existing env, then findVercelToken checks auth paths.
// Call order: readCredsFile → pullVercelCreds existingEnv → findVercelToken auth1 → [auth2 if needed] → readCredsFile after write
function mockPullPath(opts: {
  initialFile: string | null;         // null = absent, string = file content for readCredsFile + existingEnv
  authFile?: string;                   // auth.json content (defaults to {"token":"vt"})
  afterWrite: () => string;            // returns written file content for readCredsFile after write
}): void {
  const auth = opts.authFile ?? '{"token":"vt"}';
  if (opts.initialFile === null) {
    // readCredsFile: file absent → null
    // pullVercelCreds existingEnv: file absent → {}
    // findVercelToken auth1: true
    // readCredsFile after write: true
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)   // readCredsFile: absent
      .mockReturnValueOnce(false)   // pullVercelCreds existingEnv: absent
      .mockReturnValueOnce(true)    // findVercelToken auth1
      .mockReturnValueOnce(true);   // readCredsFile after write
    (vi.mocked(readFileSync) as any)
      .mockReturnValueOnce(auth);   // auth.json
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    (vi.mocked(readFileSync) as any).mockImplementationOnce(() => opts.afterWrite());
  } else {
    // readCredsFile: file exists → content (may return null if url/key missing or incomplete)
    // pullVercelCreds existingEnv: same file → content
    // findVercelToken auth1: true
    // readCredsFile after write: true
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(true)    // readCredsFile
      .mockReturnValueOnce(true)    // pullVercelCreds existingEnv
      .mockReturnValueOnce(true)    // findVercelToken auth1
      .mockReturnValueOnce(true);   // readCredsFile after write
    (vi.mocked(readFileSync) as any)
      .mockReturnValueOnce(opts.initialFile)  // readCredsFile
      .mockReturnValueOnce(opts.initialFile)  // pullVercelCreds existingEnv
      .mockReturnValueOnce(auth);             // auth.json
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    (vi.mocked(readFileSync) as any).mockImplementationOnce(() => opts.afterWrite());
  }
}

describe('hostedCreds', () => {
  it('reads creds from an existing .env.hosted file', async () => {
    (vi.mocked(existsSync) as any).mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce(
      'SUPABASE_URL=http://hosted\nSUPABASE_SERVICE_ROLE_KEY=svc-key\nREVALIDATE_URL=https://p/r\nREVALIDATE_SECRET=s',
    );
    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://hosted');
    expect(c.serviceRoleKey).toBe('svc-key');
  });

  it('strips trailing slashes from the url in the file', async () => {
    (vi.mocked(existsSync) as any).mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce(
      'SUPABASE_URL=http://hosted///\nSUPABASE_SERVICE_ROLE_KEY=k\nREVALIDATE_URL=https://p/r\nREVALIDATE_SECRET=s',
    );
    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://hosted');
  });

  it('treats a file with no SUPABASE_URL as absent (covers !url branch)', async () => {
    // File exists but has only service key → readCredsFile returns null (no url)
    // pullVercelCreds reads same file → gets service key from existingEnv
    let written = '';
    mockPullPath({
      initialFile: 'SUPABASE_SERVICE_ROLE_KEY=k',
      afterWrite: () => written,
    });
    vi.mocked(writeFileSync).mockImplementation((_p, data) => { written = String(data); });

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'http://hosted' }));

    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://hosted');
  });

  it('pulls from Vercel when .env.hosted lacks revalidate vars but has service key', async () => {
    // File has url+key but no revalidate vars → readCredsFile returns incomplete creds → pull
    let written = '';
    mockPullPath({
      initialFile: 'SUPABASE_URL=http://h\nSUPABASE_SERVICE_ROLE_KEY=k',
      afterWrite: () => written,
    });
    vi.mocked(writeFileSync).mockImplementation((_p, data) => { written = String(data); });

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'http://h' }));

    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://h');
  });

  it('returns revalidateUrl and revalidateSecret when present in Vercel env', async () => {
    let written = '';
    mockPullPath({
      initialFile: 'SUPABASE_URL=http://h\nSUPABASE_SERVICE_ROLE_KEY=k',
      afterWrite: () => written,
    });
    vi.mocked(writeFileSync).mockImplementation((_p, data) => { written = String(data); });

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
        { id: 'e2', key: 'NEXT_PUBLIC_SITE_URL', target: ['production'] },
        { id: 'e3', key: 'REVALIDATE_SECRET', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'http://h' }))
      .mockResolvedValueOnce(apiOk({ value: 'https://prod' }))
      .mockResolvedValueOnce(apiOk({ value: 'secret-abc' }));

    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://h');
    expect(c.revalidateUrl).toBe('https://prod/api/revalidate');
    expect(c.revalidateSecret).toBe('secret-abc');
  });

  it('returns undefined revalidate fields when Vercel env lacks them', async () => {
    let written = '';
    mockPullPath({
      initialFile: 'SUPABASE_URL=http://hosted\nSUPABASE_SERVICE_ROLE_KEY=svc-key',
      afterWrite: () => written,
    });
    vi.mocked(writeFileSync).mockImplementation((_p, data) => { written = String(data); });

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'http://hosted' }));

    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.revalidateUrl).toBeUndefined();
    expect(c.revalidateSecret).toBeUndefined();
  });

  it('re-pulls from Vercel when cached .env.hosted is missing revalidate vars', async () => {
    let written = '';
    mockPullPath({
      initialFile: 'SUPABASE_URL=http://hosted\nSUPABASE_SERVICE_ROLE_KEY=svc-key',
      afterWrite: () => written,
    });
    vi.mocked(writeFileSync).mockImplementation((_p, data) => { written = String(data); });

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
        { id: 'e2', key: 'NEXT_PUBLIC_SITE_URL', target: ['production'] },
        { id: 'e3', key: 'REVALIDATE_SECRET', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'http://hosted' }))
      .mockResolvedValueOnce(apiOk({ value: 'https://prod' }))
      .mockResolvedValueOnce(apiOk({ value: 'secret-abc' }));

    const c = await hostedCreds('/fake/.env.hosted');
    expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    expect(c.revalidateUrl).toBe('https://prod/api/revalidate');
    expect(c.revalidateSecret).toBe('secret-abc');
  });

  it('throws when Vercel projects API fails', async () => {
    // File absent for readCredsFile AND pullVercelCreds existingEnv; auth.json present
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)  // readCredsFile: absent → null
      .mockReturnValueOnce(false)  // pullVercelCreds existingEnv: absent → {}
      .mockReturnValueOnce(true);  // findVercelToken auth1
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock.mockResolvedValueOnce(apiFail(403));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('Vercel projects API');
  });

  it('throws when the netflix-jobs-rebuild project is not found', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock.mockResolvedValueOnce(apiOk({ projects: [] }));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('"netflix-jobs-rebuild" not found');
  });

  it('throws when Vercel env API fails', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiFail(500));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('Vercel env API');
  });

  it('throws when SUPABASE_URL is missing from Vercel env', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [] }));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('SUPABASE_URL');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is absent from both Vercel and local file', async () => {
    // File absent → existingEnv = {} → service key = undefined after var fetches
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)  // readCredsFile: absent
      .mockReturnValueOnce(false)  // pullVercelCreds existingEnv: absent → {}
      .mockReturnValueOnce(true);  // findVercelToken auth1
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'http://h' }));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY is absent');
  });

  it('rejects a ciphertext value from the per-var endpoint', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'eyJ2IjoidjIiLCJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...' }));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('ciphertext');
  });

  it('preserves existing SUPABASE_SERVICE_ROLE_KEY from local file during pull', async () => {
    let written = '';
    mockPullPath({
      initialFile: 'SUPABASE_URL=http://hosted\nSUPABASE_SERVICE_ROLE_KEY=my-preserved-key',
      afterWrite: () => written,
    });
    vi.mocked(writeFileSync).mockImplementation((_p, data) => { written = String(data); });

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs-rebuild' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [
        { id: 'e1', key: 'SUPABASE_URL', target: ['production'] },
        { id: 'e2', key: 'NEXT_PUBLIC_SITE_URL', target: ['production'] },
        { id: 'e3', key: 'REVALIDATE_SECRET', target: ['production'] },
      ]}))
      .mockResolvedValueOnce(apiOk({ value: 'http://hosted' }))
      .mockResolvedValueOnce(apiOk({ value: 'https://prod.example.com' }))
      .mockResolvedValueOnce(apiOk({ value: 'secret-abc' }));

    const c = await hostedCreds('/fake/.env.hosted');
    expect(written).toContain('my-preserved-key');
    expect(c.serviceRoleKey).toBe('my-preserved-key');
  });
});

function apiOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

function apiFail(status: number): Response {
  return {
    ok: false,
    status,
    text: async () => 'error',
    json: async () => ({ error: 'fail' }),
  } as unknown as Response;
}
