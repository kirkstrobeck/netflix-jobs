import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

// The real environment has these set (apps/web/.env.local), and the point of
// these tests is what happens when they are NOT. Clearing them per test is what
// makes the fail-closed cases reachable.
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", undefined);
  vi.stubEnv("SUPABASE_ANON_KEY", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("supabaseUrl", () => {
  it("throws when SUPABASE_URL is unset rather than falling back to the local stack", () => {
    expect(() => supabaseUrl()).toThrow(/SUPABASE_URL is not set/);
  });

  it("throws when SUPABASE_URL is empty", () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect(() => supabaseUrl()).toThrow(/SUPABASE_URL is not set/);
  });

  it("uses SUPABASE_URL when set", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    expect(supabaseUrl()).toBe("https://example.supabase.co");
  });

  it("strips trailing slashes", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co///");
    expect(supabaseUrl()).toBe("https://example.supabase.co");
  });
});

describe("supabaseAnonKey", () => {
  it("throws when SUPABASE_ANON_KEY is unset rather than shipping a bundled key", () => {
    expect(() => supabaseAnonKey()).toThrow(/SUPABASE_ANON_KEY is not set/);
  });

  it("throws when SUPABASE_ANON_KEY is empty", () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    expect(() => supabaseAnonKey()).toThrow(/SUPABASE_ANON_KEY is not set/);
  });

  it("uses SUPABASE_ANON_KEY when set", () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "custom-key");
    expect(supabaseAnonKey()).toBe("custom-key");
  });
});
