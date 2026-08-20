// Reingest the Netflix jobs board against both databases, compare counts.
//
//   node bin/reingest.ts
//   pnpm --filter @netflix-jobs/ingestor reingest
//
// Credentials: reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from env for
// local (defaulting to the local stack); reads packages/ingestor/.env.hosted
// for the hosted database, auto-creating it from the authenticated Vercel CLI
// when absent.

import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { localCreds, hostedCreds } from '../lib/reingest-creds.ts';
import { queryCounts } from '../lib/reingest-counts.ts';
import { compare, formatTable } from '../lib/reingest-compare.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = join(__dirname, '..');

function logPath(which: 'local' | 'hosted'): string {
  return join(PKG_DIR, `.ingest-${which}.log`);
}

export function runIngest(
  which: 'local' | 'hosted',
  url: string,
  serviceRoleKey: string,
  extraEnv?: Record<string, string>,
): number {
  const log = logPath(which);
  console.log(`\n── ${which} ingest (log: ${log}) ──`);

  const result = spawnSync(
    'pnpm',
    ['--filter', '@netflix-jobs/ingestor', 'ingest'],
    {
      env: {
        ...process.env,
        PNPM_HOME: process.env.PNPM_HOME ?? '/home/agent/.pnpm',
        SUPABASE_URL: url,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        ...extraEnv,
      },
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      cwd: join(PKG_DIR, '../..'),
    },
  );

  const out = [result.stdout, result.stderr].filter(Boolean).join('');
  process.stdout.write(out);
  writeFileSync(log, out, 'utf8');

  if (result.error) throw result.error;
  return result.status ?? 1;
}

export async function main(
  exit: (code: number) => void = (code) => process.exit(code),
): Promise<void> {
  const local = localCreds();
  const hosted = await hostedCreds(join(PKG_DIR, '.env.hosted'));

  const localStatus = runIngest('local', local.url, local.serviceRoleKey);
  console.log(`\nlocal exit: ${localStatus}`);

  const hostedExtraEnv: Record<string, string> = { REQUIRE_REVALIDATE: '1' };
  if (hosted.revalidateUrl) hostedExtraEnv['REVALIDATE_URL'] = hosted.revalidateUrl;
  if (hosted.revalidateSecret) hostedExtraEnv['REVALIDATE_SECRET'] = hosted.revalidateSecret;

  const hostedStatus = runIngest('hosted', hosted.url, hosted.serviceRoleKey, hostedExtraEnv);
  console.log(`\nhosted exit: ${hostedStatus}`);

  console.log('\n── database counts ──');
  const [localCounts, hostedCounts] = await Promise.all([
    queryCounts(local.url, local.serviceRoleKey),
    queryCounts(hosted.url, hosted.serviceRoleKey),
  ]);

  console.log(formatTable(localCounts, hostedCounts));

  const verdict = compare(localCounts, hostedCounts);
  const ok = localStatus === 0 && hostedStatus === 0 && verdict.agree;
  exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
