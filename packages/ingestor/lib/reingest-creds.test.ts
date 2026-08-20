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

describe('hostedCreds', () => {
  it('reads creds from an existing .env.hosted file', async () => {
    (vi.mocked(existsSync) as any).mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce(
      'SUPABASE_URL=http://hosted\nSUPABASE_SERVICE_ROLE_KEY=svc-key',
    );
    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://hosted');
    expect(c.serviceRoleKey).toBe('svc-key');
  });

  it('strips trailing slashes from the url in the file', async () => {
    (vi.mocked(existsSync) as any).mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce(
      'SUPABASE_URL=http://hosted///\nSUPABASE_SERVICE_ROLE_KEY=k',
    );
    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://hosted');
  });

  it('treats a file with no SUPABASE_URL as absent (covers !url branch)', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(true)   // .env.hosted exists
      .mockReturnValueOnce(true)   // findVercelToken: auth.json exists
      .mockReturnValueOnce(true);  // readCredsFile after pull
    (vi.mocked(readFileSync) as any)
      .mockReturnValueOnce('SUPABASE_SERVICE_ROLE_KEY=k') // no url → null
      .mockReturnValueOnce('{"token":"vt"}');

    let written = '';
    vi.mocked(writeFileSync).mockImplementation((_p, data) => {
      written = String(data);
    });
    (vi.mocked(readFileSync) as any).mockImplementationOnce(() => written);

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs' }] }))
      .mockResolvedValueOnce(
        apiOk({
          envs: [
            { key: 'SUPABASE_URL', value: 'http://hosted', target: ['production'] },
            { key: 'SUPABASE_SERVICE_ROLE_KEY', value: 'svc', target: ['production'] },
          ],
        }),
      );

    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://hosted');
  });

  it('treats a file with missing SUPABASE_SERVICE_ROLE_KEY as absent (covers !key branch)', async () => {
    // readCredsFile: file exists but has no keys → null → pull from Vercel
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(true)   // .env.hosted exists…
      .mockReturnValueOnce(true)   // findVercelToken: auth.json exists
      .mockReturnValueOnce(true);  // readCredsFile after pull: .env.hosted exists
    (vi.mocked(readFileSync) as any)
      .mockReturnValueOnce('SUPABASE_URL=only-url') // missing service key → null creds
      .mockReturnValueOnce('{"token":"vt"}');       // auth.json

    let written = '';
    vi.mocked(writeFileSync).mockImplementation((_p, data) => {
      written = String(data);
    });
    (vi.mocked(readFileSync) as any).mockImplementationOnce(() => written);

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs' }] }))
      .mockResolvedValueOnce(
        apiOk({
          envs: [
            { key: 'SUPABASE_URL', value: 'http://hosted', target: ['production'] },
            { key: 'SUPABASE_SERVICE_ROLE_KEY', value: 'svc', target: ['production'] },
            { key: 'OTHER', value: 'x', target: ['preview'] },
          ],
        }),
      );

    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://hosted');
    expect(c.serviceRoleKey).toBe('svc');
  });

  it('pulls from Vercel when .env.hosted is absent', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)  // .env.hosted missing
      .mockReturnValueOnce(true)   // auth.json found
      .mockReturnValueOnce(true);  // .env.hosted exists after write

    (vi.mocked(readFileSync) as any)
      .mockReturnValueOnce('{"token":"vt"}');

    let written = '';
    vi.mocked(writeFileSync).mockImplementation((_p, data) => {
      written = String(data);
    });
    (vi.mocked(readFileSync) as any).mockImplementationOnce(() => written);

    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs' }] }))
      .mockResolvedValueOnce(
        apiOk({
          envs: [
            { key: 'SUPABASE_URL', value: 'http://h', target: ['production'] },
            { key: 'SUPABASE_SERVICE_ROLE_KEY', value: 'k', target: ['production'] },
          ],
        }),
      );

    const c = await hostedCreds('/fake/.env.hosted');
    expect(c.url).toBe('http://h');
  });

  it('throws when Vercel projects API fails', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock.mockResolvedValueOnce(apiFail(403));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('Vercel projects API');
  });

  it('throws when the netflix-jobs project is not found', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock.mockResolvedValueOnce(apiOk({ projects: [] }));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('"netflix-jobs" not found');
  });

  it('throws when Vercel env API fails', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs' }] }))
      .mockResolvedValueOnce(apiFail(500));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('Vercel env API');
  });

  it('throws when SUPABASE_URL is missing from Vercel env', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs' }] }))
      .mockResolvedValueOnce(apiOk({ envs: [] }));
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('SUPABASE_URL');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing from Vercel env', async () => {
    (vi.mocked(existsSync) as any)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    (vi.mocked(readFileSync) as any).mockReturnValueOnce('{"token":"vt"}');
    fetchMock
      .mockResolvedValueOnce(apiOk({ projects: [{ id: 'p1', name: 'netflix-jobs' }] }))
      .mockResolvedValueOnce(
        apiOk({
          envs: [{ key: 'SUPABASE_URL', value: 'u', target: ['production'] }],
        }),
      );
    await expect(hostedCreds('/fake/.env.hosted')).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY');
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
