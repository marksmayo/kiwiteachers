import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("./auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "x" })) }));

const { getCurrentUser, isAdminEmail, resolveIsAdmin } = await import("./session");

describe("admin resolution", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("matches ADMIN_EMAILS case-insensitively", () => {
    process.env.ADMIN_EMAILS = " Boss@School.nz , other@x.nz";
    expect(isAdminEmail("boss@school.nz")).toBe(true);
    expect(isAdminEmail("nobody@x.nz")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it("grants admin via DB role, or via ADMIN_EMAILS only when the email is verified", () => {
    process.env.ADMIN_EMAILS = "boss@school.nz";
    expect(resolveIsAdmin({ role: "admin", email: "a@b" })).toBe(true);
    expect(resolveIsAdmin({ role: "user", email: "boss@school.nz", emailVerified: false })).toBe(false);
    expect(resolveIsAdmin({ role: "user", email: "boss@school.nz", emailVerified: true })).toBe(true);
  });
});

describe("getCurrentUser", () => {
  it("returns null when signed out", async () => {
    getSession.mockResolvedValueOnce(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("maps the session user, using passed headers when given", async () => {
    getSession.mockResolvedValueOnce({ user: { id: "u1", name: "Aroha", email: "a@x", role: "admin" } });
    const h = new Headers();
    expect(await getCurrentUser(h)).toEqual({ id: "u1", name: "Aroha", email: "a@x", isAdmin: true });
    expect(getSession).toHaveBeenCalledWith({ headers: h });
  });
});
