import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostedCreds } from '../lib/reingest-creds.ts';
import { readChecksums } from '../lib/db-checksums.ts';
import { readActiveJobs } from '../lib/db.ts';
import { flushCaches } from '../lib/cache-flush.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_HOSTED = join(__dirname, '..', '.env.hosted');

export async function main(): Promise<void> {
  const creds = await hostedCreds(ENV_HOSTED);
  if (!creds.revalidateUrl) throw new Error('REVALIDATE_URL missing from hosted env');
  if (!creds.revalidateSecret) throw new Error('REVALIDATE_SECRET missing from hosted env');

  process.env.SUPABASE_URL = creds.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = creds.serviceRoleKey;
  process.env.REVALIDATE_URL = creds.revalidateUrl;
  process.env.REVALIDATE_SECRET = creds.revalidateSecret;

  console.log(`endpoint: ${creds.revalidateUrl}`);

  const prior = await readChecksums();
  const rows = await readActiveJobs();
  const activeIds = new Set(rows.map((r) => Number(r.position_id)));
  const deactivated = [...prior.values()].filter(
    (p) => p.wasActive && !activeIds.has(p.position_id),
  ).length;

  console.log(`prior: ${prior.size} checksums, active: ${rows.length} rows, deactivated: ${deactivated}`);

  const { report } = await flushCaches(rows, deactivated, prior);
  console.log(`outcome: ${report.outcome}`);
  if (report.outcome !== 'ok' && report.outcome !== 'unchanged') process.exit(1);
}

void main();
