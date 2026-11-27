import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../test/pglite";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);

const { VIEW_LIMITS, isLikelyBot, isSameOriginRequest, nzDay, pruneViews, recordView, viewerIdentity } = await import("./views");

const count = async (id: string) => (await dbModule.sql(`SELECT view_count FROM resource WHERE id = $1`, [id]))[0].view_count;
const DAY = "2026-11-27";
const ident = (ip: string, ua = "Mozilla/5.0 Chrome", userId?: string) =>
  viewerIdentity({ userId, ip, userAgent: ua, secret: "secret", day: DAY });

describe("viewer identity", () => {
  it("never stores the raw IP and rotates daily", () => {
    const a = ident("203.0.113.9");
    expect(a.viewer).toMatch(/^a:/);
    expect(a.source).toMatch(/^s:/);
    expect(JSON.stringify(a)).not.toContain("203.0.113.9");
    const tomorrow = viewerIdentity({ ip: "203.0.113.9", userAgent: "Mozilla/5.0 Chrome", secret: "secret", day: "2026-11-28" });
    expect(tomorrow.viewer).not.toBe(a.viewer);
  });

  it("uses the account for signed-in users, and the IP for the source either way", () => {
    const a = ident("203.0.113.9", "Mozilla/5.0 Chrome", "user-1");
    expect(a.viewer).toBe("u:user-1");
    expect(a.source).toBe(ident("203.0.113.9").source);
  });
});

describe("request filters", () => {
  it("spots bots, scripts and missing user agents", () => {
    for (const ua of [null, "", "short", "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 (compatible; Googlebot/2.1)", "Mozilla/5.0 HeadlessChrome/120"]) {
      expect(isLikelyBot(ua)).toBe(true);
    }
    expect(isLikelyBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15")).toBe(false);
  });

  it("accepts only same-origin requests", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(isSameOriginRequest(h({ "sec-fetch-site": "same-origin" }), "a.test")).toBe(true);
    expect(isSameOriginRequest(h({ "sec-fetch-site": "cross-site", origin: "https://a.test" }), "a.test")).toBe(false);
    expect(isSameOriginRequest(h({ origin: "https://a.test" }), "a.test")).toBe(true);
    expect(isSameOriginRequest(h({ origin: "https://evil.test" }), "a.test")).toBe(false);
    expect(isSameOriginRequest(h({ origin: "not a url" }), "a.test")).toBe(false);
    expect(isSameOriginRequest(h({}), "a.test")).toBe(false);
    expect(isSameOriginRequest(h({ origin: "https://a.test" }), null)).toBe(false);
  });

  it("uses the New Zealand date", () => {
    // 11:30 UTC on 27 Nov is 00:30 on 28 Nov in NZ (daylight time).
    expect(nzDay(new Date("2026-11-27T11:30:00Z"))).toBe("2026-11-28");
  });
});

describe("recordView", () => {
  beforeEach(resetDb);

  it("counts once per viewer per resource per day", async () => {
    const r = await createResource();
    const who = ident("203.0.113.9");
    expect(await recordView(r.id, who, DAY)).toEqual({ counted: true });
    expect(await recordView(r.id, who, DAY)).toEqual({ counted: false, reason: "duplicate" });
    expect(await recordView(r.id, who, "2026-11-28")).toEqual({ counted: true });
    expect(await count(r.id)).toBe(2);
  });

  it("skips unpublished resources, the uploader and admins", async () => {
    const u = await createUser();
    const pending = await createResource({ status: "pending" });
    const own = await createResource({ uploaded_by: u.id });
    expect((await recordView(pending.id, ident("1.1.1.1"), DAY)).reason).toBe("not-countable");
    expect((await recordView(own.id, { ...ident("1.1.1.1", "x", u.id), userId: u.id }, DAY)).reason).toBe("not-countable");
    expect((await recordView(own.id, { ...ident("1.1.1.2"), isAdmin: true }, DAY)).reason).toBe("not-countable");
    expect(await count(own.id)).toBe(0);
  });

  it("caps how many views one IP can add to one resource, even with fake browsers", async () => {
    const r = await createResource();
    for (let i = 0; i < VIEW_LIMITS.perSourcePerResource + 5; i++) {
      await recordView(r.id, ident("203.0.113.9", `Mozilla/5.0 fake-${i}`), DAY);
    }
    expect(await count(r.id)).toBe(VIEW_LIMITS.perSourcePerResource);
    expect((await recordView(r.id, ident("203.0.113.9", "Mozilla/5.0 another"), DAY)).reason).toBe("limit");
  });

  it("caps how many resources one viewer can add views to", async () => {
    const who = ident("203.0.113.9");
    const rs = await Promise.all(Array.from({ length: VIEW_LIMITS.perViewer + 2 }, () => createResource()));
    let counted = 0;
    for (const r of rs) if ((await recordView(r.id, who, DAY)).counted) counted++;
    expect(counted).toBe(VIEW_LIMITS.perViewer);
  });

  it("holds up under parallel requests", async () => {
    const r = await createResource();
    const who = ident("203.0.113.9");
    await Promise.all(Array.from({ length: 10 }, () => recordView(r.id, who, DAY)));
    expect(await count(r.id)).toBe(1);
  });

  it("prunes old de-duplication rows but keeps the counts", async () => {
    const r = await createResource();
    await recordView(r.id, ident("1.1.1.1"), "2026-11-20");
    await recordView(r.id, ident("1.1.1.2"), "2026-11-27");
    expect(await pruneViews(2, new Date("2026-11-27T00:00:00Z"))).toBe(1);
    expect(await count(r.id)).toBe(2);
  });
});
