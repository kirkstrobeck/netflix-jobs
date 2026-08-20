import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:54721';
const DEFAULT_LOCAL_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const VERCEL_TEAM_ID = 'team_EPy6b0j3x1VvmGdr7oBuJGN1';
const VERCEL_PROJECT_NAME = 'netflix-jobs-rebuild';

const CIPHERTEXT_PREFIX = 'eyJ2IjoidjIi';

export type Creds = { url: string; serviceRoleKey: string };
export type HostedCreds = Creds & { revalidateUrl?: string; revalidateSecret?: string };

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    out[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return out;
}

export function localCreds(): Creds {
  return {
    url: (process.env.SUPABASE_URL ?? DEFAULT_LOCAL_URL).replace(/\/+$/, ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? DEFAULT_LOCAL_KEY,
  };
}

function readCredsFile(path: string): HostedCreds | null {
  if (!existsSync(path)) return null;
  const env = parseEnvFile(readFileSync(path, 'utf8'));
  const url = env['SUPABASE_URL'];
  const key = env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url) return null;
  if (!key) return null;
  return {
    url: url.replace(/\/+$/, ''),
    serviceRoleKey: key,
    revalidateUrl: env['REVALIDATE_URL'],
    revalidateSecret: env['REVALIDATE_SECRET'],
  };
}

function vercelAuthPaths(): string[] {
  const home = process.env.HOME ?? '/home/agent';
  return [
    `${home}/.local/share/com.vercel.cli/auth.json`,
    `${home}/Library/Application Support/com.vercel.cli/auth.json`,
  ];
}

export function findVercelToken(): string {
  for (const path of vercelAuthPaths()) {
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8')) as { token?: string };
    if (data.token) return data.token;
  }
  throw new Error(`Vercel auth token not found; tried: ${vercelAuthPaths().join(', ')}`);
}

async function vercelProjectId(token: string): Promise<string> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects?limit=100&teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Vercel projects API returned ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { projects: Array<{ id: string; name: string }> };
  const project = body.projects.find((p) => p.name === VERCEL_PROJECT_NAME);
  if (!project) throw new Error(`Vercel project "${VERCEL_PROJECT_NAME}" not found`);
  return project.id;
}

type EnvEntry = { id: string; key: string; target: string[] };

async function vercelListEnv(token: string, projectId: string): Promise<EnvEntry[]> {
  const url = `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${VERCEL_TEAM_ID}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Vercel env API returned ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { envs: EnvEntry[] };
  return body.envs.filter((e) => e.target.includes('production'));
}

async function vercelEnvVar(token: string, projectId: string, envId: string, key: string): Promise<string> {
  const url = `https://api.vercel.com/v9/projects/${projectId}/env/${envId}?teamId=${VERCEL_TEAM_ID}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Vercel env var API returned ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { value: string };
  if (body.value.startsWith(CIPHERTEXT_PREFIX)) {
    throw new Error(`Vercel returned ciphertext for ${key} — decrypt=true was silently ignored`);
  }
  return body.value;
}

async function pullVercelCreds(outPath: string): Promise<void> {
  const existingEnv = existsSync(outPath) ? parseEnvFile(readFileSync(outPath, 'utf8')) : {};
  const token = findVercelToken();
  const projectId = await vercelProjectId(token);
  const list = await vercelListEnv(token, projectId);

  const pulled: Record<string, string> = {};
  for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SITE_URL', 'REVALIDATE_SECRET']) {
    const entry = list.find((e) => e.key === key);
    if (!entry) continue;
    pulled[key] = await vercelEnvVar(token, projectId, entry.id, key);
  }

  const url = pulled['SUPABASE_URL'];
  if (!url) throw new Error('Vercel production env is missing SUPABASE_URL');

  if (pulled['NEXT_PUBLIC_SITE_URL']) {
    pulled['REVALIDATE_URL'] = pulled['NEXT_PUBLIC_SITE_URL'].replace(/\/+$/, '') + '/api/revalidate';
  }

  const serviceKey = existingEnv['SUPABASE_SERVICE_ROLE_KEY'];
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is absent from both Vercel and the local .env.hosted — cannot proceed',
    );
  }

  let contents = `SUPABASE_URL=${url}\nSUPABASE_SERVICE_ROLE_KEY=${serviceKey}\n`;
  if (pulled['REVALIDATE_URL']) contents += `REVALIDATE_URL=${pulled['REVALIDATE_URL']}\n`;
  if (pulled['REVALIDATE_SECRET']) contents += `REVALIDATE_SECRET=${pulled['REVALIDATE_SECRET']}\n`;
  writeFileSync(outPath, contents, 'utf8');
}

export async function hostedCreds(envHostedPath: string): Promise<HostedCreds> {
  const existing = readCredsFile(envHostedPath);
  if (existing?.revalidateUrl && existing?.revalidateSecret) return existing;
  await pullVercelCreds(envHostedPath);
  return readCredsFile(envHostedPath) as HostedCreds;
}
