import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

describe("proxy (CSP)", () => {
  it("gives each page request its own nonce and passes it to Next.js", () => {
    const a = proxy(new NextRequest("https://kiwiteachers.test/resources"));
    const b = proxy(new NextRequest("https://kiwiteachers.test/resources"));
    const cspA = a.headers.get("content-security-policy")!;
    const nonce = /'nonce-([^']+)'/.exec(cspA)![1];
    expect(cspA).toContain("'strict-dynamic'");
    expect(b.headers.get("content-security-policy")).not.toContain(nonce);
    // The rewritten request headers are forwarded via x-middleware-request-* headers.
    expect(a.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(a.headers.get("x-middleware-request-content-security-policy")).toBe(cspA);
  });

  it("gives API routes a no-scripts policy without a nonce", () => {
    const res = proxy(new NextRequest("https://kiwiteachers.test/api/resources/x/file"));
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("x-middleware-request-x-nonce")).toBeNull();
  });

  it("skips static assets", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/_next/static/chunks/a.js")).toBe(false);
    expect(re.test("/resources/abc")).toBe(true);
  });
});
