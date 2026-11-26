import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("locks down framing, objects and base URIs in production", () => {
    const csp = buildCsp(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toMatch(/connect-src [^;]*https:\/\/vercel\.com/);
    expect(csp).toMatch(/worker-src 'self' blob:/);
  });

  it("allows eval and websockets only in development", () => {
    const csp = buildCsp(true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("sends the standard hardening headers, HSTS only in production", () => {
    const prod = Object.fromEntries(securityHeaders(false).map((h) => [h.key, h.value]));
    expect(prod["X-Content-Type-Options"]).toBe("nosniff");
    expect(prod["X-Frame-Options"]).toBe("DENY");
    expect(prod["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(prod["Permissions-Policy"]).toContain("camera=()");
    expect(prod["Strict-Transport-Security"]).toContain("max-age=");
    const dev = Object.fromEntries(securityHeaders(true).map((h) => [h.key, h.value]));
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
  });
});
