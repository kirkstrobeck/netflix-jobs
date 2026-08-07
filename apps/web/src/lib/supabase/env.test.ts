import { afterEach, describe, expect, it, vi } from "vitest";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("supabaseUrl", () => {
  it("defaults to the local Supabase stack", () => {
    expect(supabaseUrl()).toBe("http://127.0.0.1:54721");
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
  it("defaults to the demo anon key", () => {
    expect(supabaseAnonKey()).toContain("eyJ");
  });

  it("uses SUPABASE_ANON_KEY when set", () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "custom-key");
    expect(supabaseAnonKey()).toBe("custom-key");
  });
});
