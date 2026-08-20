import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostedCreds } from '../lib/reingest-creds.ts';
import { revalidateWeb } from '../lib/revalidate.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_HOSTED = join(__dirname, '..', '.env.hosted');

const creds = await hostedCreds(ENV_HOSTED);
if (!creds.revalidateUrl) throw new Error('REVALIDATE_URL missing from Vercel env');
if (!creds.revalidateSecret) throw new Error('REVALIDATE_SECRET missing from Vercel env');

process.env.REVALIDATE_URL = creds.revalidateUrl;
process.env.REVALIDATE_SECRET = creds.revalidateSecret;

console.log(`endpoint: ${creds.revalidateUrl}`);
const outcome = await revalidateWeb([], true);
console.log(`outcome: ${outcome}`);
if (outcome !== 'ok') process.exit(1);
