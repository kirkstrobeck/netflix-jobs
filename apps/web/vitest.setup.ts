import { vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/font/local", () => ({
  default: () => ({
    className: "netflix-sans",
    variable: "--font-netflix-sans",
  }),
}));
