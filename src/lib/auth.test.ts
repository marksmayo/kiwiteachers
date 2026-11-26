import { afterEach, describe, expect, it } from "vitest";
import { trustedOrigins } from "./auth";

describe("trustedOrigins", () => {
  afterEach(() => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_TEAM_SLUG;
  });

  it("trusts only this project's deployments, never all of *.vercel.app", () => {
    const origins = trustedOrigins();
    expect(origins).toContain("https://kiwiteachers.vercel.app");
    expect(origins).toContain("https://kiwiteachers-*-marks-projects-61167feb.vercel.app");
    expect(origins).not.toContain("https://*.vercel.app");
    expect(origins.every((o) => o.startsWith("https://kiwiteachers"))).toBe(true);
  });

  it("adds the production domain and honours a team override", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "kiwiteachers.co.nz";
    process.env.VERCEL_TEAM_SLUG = "acme";
    const origins = trustedOrigins();
    expect(origins).toContain("https://kiwiteachers.co.nz");
    expect(origins).toContain("https://kiwiteachers-*-acme.vercel.app");
  });
});

describe("assertDeletePassword", () => {
  it("requires a password for account deletion only", async () => {
    const { assertDeletePassword } = await import("./auth");
    expect(() => assertDeletePassword("/delete-user", {})).toThrow(/password/);
    expect(() => assertDeletePassword("/delete-user", { password: "" })).toThrow(/password/);
    expect(() => assertDeletePassword("/delete-user", undefined)).toThrow(/password/);
    expect(() => assertDeletePassword("/delete-user", { password: "hunter22" })).not.toThrow();
    expect(() => assertDeletePassword("/update-user", {})).not.toThrow();
  });
});

describe("baseURL", () => {
  const keys = ["BETTER_AUTH_URL", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
  afterEach(() => keys.forEach((k) => delete process.env[k]));

  it("prefers BETTER_AUTH_URL, then the production domain, then the deployment URL, then localhost", async () => {
    const { baseURL } = await import("./auth");
    expect(baseURL()).toBe("http://localhost:3000");
    process.env.VERCEL_URL = "kiwiteachers-abc.vercel.app";
    expect(baseURL()).toBe("https://kiwiteachers-abc.vercel.app");
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "kiwiteachers.co.nz";
    expect(baseURL()).toBe("https://kiwiteachers.co.nz");
    process.env.BETTER_AUTH_URL = "http://localhost:3017";
    expect(baseURL()).toBe("http://localhost:3017");
  });
});
