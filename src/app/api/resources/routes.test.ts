import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../../../test/pglite";
import { blobStore } from "../../../../test/blob-mock";
import { makePdf, WEBP_BYTES } from "../../../../test/pdf-fixtures";

vi.mock("@/lib/db", async () => (await import("../../../../test/pglite")).dbModule);
vi.mock("@vercel/blob", async () => (await import("../../../../test/blob-mock")).blobModule);

let currentUser: { id: string; name: string; email: string; isAdmin: boolean } | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn(async () => currentUser) }));

const file = await import("./[id]/file/route");
const thumb = await import("./[id]/thumb/route");
const view = await import("./[id]/view/route");
const preview = await import("./[id]/preview/[page]/route");
const pctx = (id: string, page: string) => ({ params: Promise.resolve({ id, page }) }) as never;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const req = (url: string) => new Request(`http://localhost${url}`);
const as = async (opts: { role?: string } = {}) => {
  const u = await createUser(opts);
  currentUser = { id: u.id, name: "T", email: "t@example.com", isAdmin: u.isAdmin };
  return u;
};

let pdf: Uint8Array;

describe("GET /api/resources/[id]/file", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
    currentUser = null;
    pdf ??= await makePdf(1);
  });

  async function seed(extra = {}) {
    const r = await createResource({ blob_pathname: "docs/x/a.pdf", ...extra });
    blobStore.set("docs/x/a.pdf", pdf);
    return r;
  }

  it("serves a watermarked preview to anonymous visitors", async () => {
    const r = await seed();
    const res = await file.GET(req(`/api/resources/${r.id}/file`), ctx(r.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline/);
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).not.toBe(pdf.byteLength);
  });

  it("watermarks previews for signed-in members too (clean copy = counted download)", async () => {
    const r = await seed();
    await as();
    const res = await file.GET(req(`/api/resources/${r.id}/file`), ctx(r.id));
    expect((await res.arrayBuffer()).byteLength).not.toBe(pdf.byteLength);
  });

  it("serves the clean file to admins and the uploader", async () => {
    const admin = await as({ role: "admin" });
    const r = await seed({ uploaded_by: admin.id });
    const res = await file.GET(req(`/api/resources/${r.id}/file`), ctx(r.id));
    expect((await res.arrayBuffer()).byteLength).toBe(pdf.byteLength);
  });

  it("redirects anonymous downloads to sign-in", async () => {
    const r = await seed();
    const res = await file.GET(req(`/api/resources/${r.id}/file?download=1`), ctx(r.id));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(`/sign-in?next=/resources/${r.slug}`);
  });

  it("serves clean attachments to members and enforces the daily limit", async () => {
    await as();
    const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => createResource({ blob_pathname: `docs/x/${i}.pdf` })));
    rs.forEach((_, i) => blobStore.set(`docs/x/${i}.pdf`, pdf));
    for (const r of rs.slice(0, 5)) {
      const res = await file.GET(req(`/api/resources/${r.id}/file?download=1`), ctx(r.id));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect((await res.arrayBuffer()).byteLength).toBe(pdf.byteLength);
    }
    const blocked = await file.GET(req(`/api/resources/${rs[5].id}/file?download=1`), ctx(rs[5].id));
    expect(blocked.status).toBe(302);
    expect(blocked.headers.get("location")).toContain(`/resources/${rs[5].slug}?limit=reached`);
  });

  it("hides pending resources from everyone but admins and the uploader", async () => {
    const r = await seed({ status: "pending" });
    expect((await file.GET(req(`/api/resources/${r.id}/file`), ctx(r.id))).status).toBe(404);
    await as();
    expect((await file.GET(req(`/api/resources/${r.id}/file?download=1`), ctx(r.id))).status).toBe(404);
  });

  it("404s for unknown resources and missing files", async () => {
    expect((await file.GET(req(`/api/resources/x/file`), ctx("x"))).status).toBe(404);
    const r = await createResource({ blob_pathname: "docs/x/missing.pdf" });
    expect((await file.GET(req(`/api/resources/${r.id}/file`), ctx(r.id))).status).toBe(404);
  });
});

describe("GET /api/resources/[id]/thumb", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
    currentUser = null;
  });

  it("serves valid public thumbnails with long caching", async () => {
    const r = await createResource({ thumb_pathname: "thumbs/x/t.webp" });
    blobStore.set("thumbs/x/t.webp", WEBP_BYTES);
    const res = await thumb.GET(req(""), ctx(r.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("refuses non-image content and missing thumbs", async () => {
    const r = await createResource({ thumb_pathname: "thumbs/x/t.webp" });
    blobStore.set("thumbs/x/t.webp", new TextEncoder().encode("<svg onload=alert(1)>"));
    expect((await thumb.GET(req(""), ctx(r.id))).status).toBe(404);
    const none = await createResource();
    expect((await thumb.GET(req(""), ctx(none.id))).status).toBe(404);
    const gone = await createResource({ thumb_pathname: "thumbs/x/gone.webp" });
    expect((await thumb.GET(req(""), ctx(gone.id))).status).toBe(404);
  });

  it("only shows pending thumbnails to privileged viewers, uncached", async () => {
    const admin = await createUser({ role: "admin" });
    const r = await createResource({ status: "pending", thumb_pathname: "thumbs/x/p.webp" });
    blobStore.set("thumbs/x/p.webp", WEBP_BYTES);
    expect((await thumb.GET(req(""), ctx(r.id))).status).toBe(404);
    currentUser = { id: admin.id, name: "A", email: "a@x", isAdmin: true };
    const res = await thumb.GET(req(""), ctx(r.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("image previews", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
    currentUser = null;
    pdf ??= await makePdf(1);
  });

  async function withPreviews(extra = {}) {
    const r = await createResource({ blob_pathname: "docs/x/a.pdf", ...extra });
    await dbModule.sql(`UPDATE resource SET preview_pathnames = '{previews/x/p1.webp,previews/x/p2.webp}' WHERE id = $1`, [r.id]);
    blobStore.set("docs/x/a.pdf", pdf);
    blobStore.set("previews/x/p1.webp", WEBP_BYTES);
    blobStore.set("previews/x/p2.webp", new TextEncoder().encode("<html>"));
    return r;
  }

  it("serves page images publicly with CDN caching", async () => {
    const r = await withPreviews();
    const res = await preview.GET(req(""), pctx(r.id, "1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("s-maxage");
  });

  it("404s for bad page numbers, unknown resources and non-image content", async () => {
    const r = await withPreviews();
    for (const p of ["0", "3", "1.5", "abc"]) expect((await preview.GET(req(""), pctx(r.id, p))).status).toBe(404);
    expect((await preview.GET(req(""), pctx(r.id, "2"))).status).toBe(404);
    expect((await preview.GET(req(""), pctx("nope", "1"))).status).toBe(404);
  });

  it("keeps pending previews private", async () => {
    const owner = await createUser();
    const r = await withPreviews({ status: "pending", uploaded_by: owner.id });
    expect((await preview.GET(req(""), pctx(r.id, "1"))).status).toBe(404);
    currentUser = { id: owner.id, name: "o", email: "o@x", isAdmin: false };
    const res = await preview.GET(req(""), pctx(r.id, "1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("no longer sends the PDF itself to visitors or members once previews exist", async () => {
    const r = await withPreviews();
    expect((await file.GET(req(`/api/resources/${r.id}/file`), ctx(r.id))).status).toBe(404);
    await as();
    expect((await file.GET(req(`/api/resources/${r.id}/file`), ctx(r.id))).status).toBe(404);
    expect((await file.GET(req(`/api/resources/${r.id}/file?download=1`), ctx(r.id))).status).toBe(200);
  });
});

describe("POST /api/resources/[id]/view", () => {
  beforeEach(async () => {
    await resetDb();
    currentUser = null;
  });
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36";
  const beacon = (id: string, h: Record<string, string> = {}) =>
    view.POST(
      new Request(`http://localhost/api/resources/${id}/view`, {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin", "user-agent": UA, "x-real-ip": "203.0.113.9", ...h },
      }),
      ctx(id),
    );
  const count = async (id: string) => (await dbModule.sql(`SELECT view_count FROM resource WHERE id = $1`, [id]))[0].view_count;

  it("rejects junk ids", async () => {
    expect((await beacon("junk")).status).toBe(400);
  });

  it("counts a browser view once per visitor per day", async () => {
    const r = await createResource();
    expect((await beacon(r.id)).status).toBe(204);
    await beacon(r.id);
    await beacon(r.id);
    expect(await count(r.id)).toBe(1);
    await beacon(r.id, { "x-real-ip": "198.51.100.4" });
    expect(await count(r.id)).toBe(2);
  });

  it("ignores cross-site requests, bots and scripts, but still answers 204", async () => {
    const r = await createResource();
    expect((await beacon(r.id, { "sec-fetch-site": "cross-site" })).status).toBe(204);
    await beacon(r.id, { "user-agent": "curl/8.4.0" });
    await beacon(r.id, { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" });
    expect(await count(r.id)).toBe(0);
  });

  it("counts signed-in members by account and skips the uploader", async () => {
    const owner = await as();
    const r = await createResource({ uploaded_by: owner.id });
    await beacon(r.id);
    expect(await count(r.id)).toBe(0);
    await as();
    await beacon(r.id);
    await beacon(r.id, { "user-agent": UA + " Edg/140" });
    expect(await count(r.id)).toBe(1);
  });
});
