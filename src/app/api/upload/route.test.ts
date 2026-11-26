import { describe, expect, it, vi } from "vitest";

let currentUser: { id: string; isAdmin: boolean } | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn(async () => currentUser) }));

// Drive onBeforeGenerateToken directly; the real handleUpload talks to Vercel.
vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(async ({ body, onBeforeGenerateToken }) => {
    const opts = await onBeforeGenerateToken(body.payload.pathname, null, false);
    return { type: "blob.generate-client-token", clientToken: "tok", opts };
  }),
}));

const allowUploadToken = vi.fn(async () => true);
vi.mock("@/lib/upload-limit", () => ({ allowUploadToken }));

const { POST } = await import("./route");

const call = (pathname: string) =>
  POST(
    new Request("http://localhost/api/upload", {
      method: "POST",
      body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname, clientPayload: null, multipart: false } }),
    }),
  );

describe("POST /api/upload", () => {
  it("requires sign-in", async () => {
    currentUser = null;
    const res = await call("docs/u1/a.pdf");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Please sign in to upload" });
  });

  it("lets any signed-in user upload into their own folder, with tight limits", async () => {
    currentUser = { id: "u1", isAdmin: false };
    const res = await call("docs/u1/a.pdf");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.opts.allowedContentTypes).toEqual(["application/pdf"]);
    expect(json.opts.validUntil).toBeGreaterThan(Date.now());
  });

  it("enforces the upload rate limit", async () => {
    currentUser = { id: "u1", isAdmin: false };
    allowUploadToken.mockResolvedValueOnce(false);
    const res = await call("previews/u1/p1.webp");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Too many uploads/);
  });

  it("returns 400 (not 500) for malformed bodies", async () => {
    const res = await POST(new Request("http://localhost/api/upload", { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
  });

  it("rejects other folders", async () => {
    currentUser = { id: "u1", isAdmin: true };
    const res = await call("docs/u2/a.pdf");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid upload path" });
  });
});
