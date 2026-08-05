import "server-only";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

// A single read verb is all the job pages need. Callers own their own caching via
// `use cache`, so nothing here reaches for fetch cache options.
export async function restGet<T>(path: string): Promise<T> {
  const key = supabaseAnonKey();

  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`GET ${path} -> ${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as T;
}
