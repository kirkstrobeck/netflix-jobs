import "server-only";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

// The read verb's sibling: a Postgres function, called by name.
//
// Separate from rest.ts rather than a second export in it, because it is a
// different shape of request -- POST with a JSON body -- and rest.ts says in as
// many words that a single read verb is all the job pages need. That is still
// true of the job pages; this is for the one caller that has to hand the
// database a value it does not store.
//
// POST rather than GET, even though PostgREST will serve a `stable` function
// over GET. The only argument this app passes is a visitor's approximate
// position, and a query string is the part of a request that ends up in access
// logs, proxy caches and Referer headers. A body does not.
//
// No caching, by construction: nothing here reaches for a fetch cache option and
// the one caller is a request-time route handler. An argument-keyed `use cache`
// over a per-visitor coordinate would be a cache entry per visitor.
export async function restRpc<T>(fn: string, args: unknown): Promise<T> {
  const key = supabaseAnonKey();

  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    throw new Error(`RPC ${fn} -> ${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as T;
}
