import "server-only";

// Reads go through the local Supabase PostgREST endpoint with the anon key, which
// is constrained by RLS to the "public can read active jobs" policy. Using the HTTP
// API instead of a pg client keeps the web app dependency-free, matching
// packages/ingestor/lib/db.ts.

const DEFAULT_URL = "http://127.0.0.1:54721";

// Supabase's local stack ships a fixed demo anon JWT. It grants nothing beyond the
// public read policies, but override it for anything real.
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? DEFAULT_URL).replace(/\/+$/, "");
}

export function supabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY ?? DEFAULT_ANON_KEY;
}
