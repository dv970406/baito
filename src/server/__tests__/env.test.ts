import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveBackend } from "../env";

describe("resolveBackend", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.BAITO_DATA_BACKEND;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllEnvs();
  });

  it("명시된 BAITO_DATA_BACKEND 가 우선한다", () => {
    process.env.BAITO_DATA_BACKEND = "memory";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    expect(resolveBackend()).toBe("memory");
  });

  it("키가 둘 다 있으면 supabase", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    expect(resolveBackend()).toBe("supabase");
  });

  it("키가 하나만 있으면 개발에서는 memory", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    expect(resolveBackend()).toBe("memory");
  });

  it("프로덕션에서 키가 없으면 unconfigured", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveBackend()).toBe("unconfigured");
  });

  it("빈 문자열은 미설정으로 취급한다", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.BAITO_DATA_BACKEND = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    expect(resolveBackend()).toBe("memory");
  });

  it("잘못된 BAITO_DATA_BACKEND 값은 ZodError", () => {
    process.env.BAITO_DATA_BACKEND = "redis";
    expect(() => resolveBackend()).toThrow();
  });
});
