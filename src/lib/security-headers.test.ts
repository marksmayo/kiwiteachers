import { describe, expect, it } from "vitest";
import { API_CSP, buildCsp, newNonce, securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("only runs scripts carrying the per-request nonce in production", () => {
    const csp = buildCsp(false, "abc123");
    expect(csp).toMatch(/script-src 'self' 'nonce-abc123' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toMatch(/worker-src 'self' blob:/);
    expect(csp).not.toContain("vercel.live");
  });

  it("allows eval and websockets only in development", () => {
    const csp = buildCsp(true, "n");
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("makes a fresh, unguessable nonce each time", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });

  it("locks API responses down completely", () => {
    expect(API_CSP).toContain("default-src 'none'");
    expect(API_CSP).toContain("frame-ancestors 'none'");
    expect(API_CSP).not.toContain("script-src");
  });

  it("sends the standard hardening headers, HSTS only in production", () => {
    const prod = Object.fromEntries(securityHeaders(false).map((h) => [h.key, h.value]));
    expect(prod["Content-Security-Policy"]).toBeUndefined(); // set per request by src/proxy.ts
    expect(prod["X-Content-Type-Options"]).toBe("nosniff");
    expect(prod["X-Frame-Options"]).toBe("DENY");
    expect(prod["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(prod["Permissions-Policy"]).toContain("camera=()");
    expect(prod["Strict-Transport-Security"]).toContain("max-age=");
    const dev = Object.fromEntries(securityHeaders(true).map((h) => [h.key, h.value]));
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
  });
});
