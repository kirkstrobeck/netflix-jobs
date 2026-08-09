import "server-only";

// Reads go through the Supabase PostgREST endpoint with the anon key, which is
// constrained by RLS to the "public can read active jobs" policy. Using the HTTP
// API instead of a pg client keeps the web app dependency-free, matching
// packages/ingestor/lib/db.ts.

/**
 * The two values that connect this app to its data, and NEITHER HAS A DEFAULT.
 *
 * WHY A THROW RATHER THAN A FALLBACK
 *
 * Both of these used to fall back to the local stack -- http://127.0.0.1:54721
 * and the fixed demo anon JWT that every `supabase start` ships. That is a
 * comfortable default on a laptop and a silent failure anywhere else: a deploy
 * that is missing its environment does not stop, it points at a loopback
 * address that no serverless function has, waits for the connection to fail,
 * and renders a board with nothing on it. An empty job board is
 * indistinguishable from a job board with no jobs, so the mistake reaches a
 * visitor looking like data rather than like an outage.
 *
 * Failing here instead turns that into the loudest possible signal, at the
 * first read, naming the variable that is missing. The deploy breaks, which is
 * the correct outcome for a deploy that cannot reach its database.
 *
 * IT ALSO KEEPS THE CREDENTIAL OUT OF THE REPOSITORY
 *
 * The demo key was public -- Supabase documents it and it grants only what the
 * read policies already allow -- but a JWT literal in a tracked file is a thing
 * every future reader has to stop and evaluate, and the one after it may not be
 * a demo key. There is now no key in here to evaluate.
 *
 * Local development sets both in apps/web/.env.local, which is gitignored.
 */
function required(name: string): string {
  const value = process.env[name];

  if (value) {
    return value;
  }

  throw new Error(
    `${name} is not set. The web app has no default for it: set it in apps/web/.env.local for local development, or in the deployment's environment.`,
  );
}

export function supabaseUrl(): string {
  // Trailing slashes are stripped because every caller joins with "/rest/v1/..."
  // and a pasted dashboard URL often ends in one.
  return required("SUPABASE_URL").replace(/\/+$/, "");
}

export function supabaseAnonKey(): string {
  return required("SUPABASE_ANON_KEY");
}
