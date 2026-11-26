import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../test/pglite";
import { blobStore } from "../../test/blob-mock";
import { makeJsPdf, makePdf, WEBP_BYTES } from "../../test/pdf-fixtures";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);
vi.mock("@/lib/db", async () => (await import("../../test/pglite")).dbModule);
vi.mock("@vercel/blob", async () => (await import("../../test/blob-mock")).blobModule);

const svc = await import("./resource-service");
const { saveResource, deleteResource, decideResource, cleanupUserData, cleanResourceInput, slugify, CONTRIBUTOR_DAILY_LIMIT } = svc;

const base = {
  title: "Matariki star fractions",
  description: "Fractions with stars",
  years: [4, 5],
  learningAreas: ["maths"],
  resourceType: "worksheet",
  tags: ["Fractions", "matariki", "fractions"],
  curriculumCodes: ["ma.p2.1"],
};

async function stagePdf(userId: string, name = "a.pdf", bytes?: Uint8Array) {
  const path = `docs/${userId}/${name}`;
  blobStore.set(path, bytes ?? (await makePdf(2)));
  return path;
}

const row = async (id: string) => (await dbModule.sql(`SELECT * FROM resource WHERE id = $1`, [id]))[0];
const bySlug = async (slug: string) => (await dbModule.sql(`SELECT * FROM resource WHERE slug = $1`, [slug]))[0];

describe("cleanResourceInput", () => {
  it("normalises tags and codes", () => {
    const c = cleanResourceInput(base);
    expect(c.tags).toEqual(["fractions", "matariki"]);
    expect(c.curriculumCodes).toEqual(["MA.P2.1"]);
  });
  it.each([
    [{ title: "  " }, /Title/],
    [{ resourceType: "nope" }, /resource type/],
    [{ years: [99] }, /year level/],
    [{ learningAreas: ["nope"] }, /learning area/],
    [{ curriculumCodes: ["<bad>"] }, /curriculum code/],
  ])("rejects %j", (patch, msg) => {
    expect(() => cleanResourceInput({ ...base, ...patch })).toThrow(msg);
  });
  it("slugifies titles with macrons", () => {
    expect(slugify("Te Reo Māori: Kupu!")).toBe("te-reo-maori-kupu");
  });
});

describe("saveResource", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
  });

  it("publishes admin uploads immediately with page count and size", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await saveResource(admin, { ...base, blobPathname: await stagePdf(admin.id) });
    expect(res).toMatchObject({ ok: true, status: "published" });
    const r = await bySlug((res as { slug: string }).slug);
    expect(r).toMatchObject({ status: "published", page_count: 2, uploaded_by: admin.id, curriculum_codes: ["MA.P2.1"] });
    expect(r.file_size).toBeGreaterThan(0);
  });

  it("puts contributor uploads into the approval queue", async () => {
    const user = await createUser();
    const res = await saveResource(user, { ...base, blobPathname: await stagePdf(user.id), acceptedRights: true });
    expect(res).toMatchObject({ ok: true, status: "pending" });
  });

  it("requires contributors to confirm they hold the rights", async () => {
    const user = await createUser();
    const res = await saveResource(user, { ...base, blobPathname: await stagePdf(user.id) });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/right to share/) });
  });

  it("requires a file for new resources", async () => {
    const admin = await createUser({ role: "admin" });
    expect(await saveResource(admin, base)).toEqual({ ok: false, error: "Please attach a PDF" });
  });

  it("refuses files in someone else's folder", async () => {
    const a = await createUser();
    const b = await createUser();
    const path = await stagePdf(b.id);
    const res = await saveResource(a, { ...base, blobPathname: path, acceptedRights: true });
    expect(res).toEqual({ ok: false, error: "Invalid file" });
    expect(blobStore.has(path)).toBe(true);
  });

  it("reports a missing upload", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await saveResource(admin, { ...base, blobPathname: `docs/${admin.id}/ghost.pdf` });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/not found/) });
  });

  it("rejects and deletes dangerous PDFs", async () => {
    const admin = await createUser({ role: "admin" });
    const path = await stagePdf(admin.id, "evil.pdf", await makeJsPdf());
    const res = await saveResource(admin, { ...base, blobPathname: path });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/active content/) });
    expect(blobStore.has(path)).toBe(false);
  });

  it("keeps valid thumbnails and discards invalid or foreign ones", async () => {
    const admin = await createUser({ role: "admin" });
    const good = `thumbs/${admin.id}/t.webp`;
    blobStore.set(good, WEBP_BYTES);
    const res = await saveResource(admin, { ...base, blobPathname: await stagePdf(admin.id), thumbPathname: good });
    expect((await bySlug((res as { slug: string }).slug)).thumb_pathname).toBe(good);

    const bad = `thumbs/${admin.id}/bad.webp`;
    blobStore.set(bad, new TextEncoder().encode("<svg/>"));
    const res2 = await saveResource(admin, { ...base, blobPathname: await stagePdf(admin.id, "b.pdf"), thumbPathname: bad });
    expect((await bySlug((res2 as { slug: string }).slug)).thumb_pathname).toBeNull();
    expect(blobStore.has(bad)).toBe(false);

    const res3 = await saveResource(admin, { ...base, blobPathname: await stagePdf(admin.id, "c.pdf"), thumbPathname: "thumbs/other/t.webp" });
    expect((await bySlug((res3 as { slug: string }).slug)).thumb_pathname).toBeNull();
  });

  it("enforces the contributor daily limit", async () => {
    const user = await createUser();
    for (let i = 0; i < CONTRIBUTOR_DAILY_LIMIT; i++) await createResource({ uploaded_by: user.id, status: "rejected" });
    const res = await saveResource(user, { ...base, blobPathname: await stagePdf(user.id), acceptedRights: true });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/submission limit/) });
  });

  it("enforces the pending-queue cap", async () => {
    const user = await createUser();
    for (let i = 0; i < 20; i++) {
      const r = await createResource({ uploaded_by: user.id, status: "pending" });
      await dbModule.sql(`UPDATE resource SET created_at = now() - interval '3 days' WHERE id = $1`, [r.id]);
    }
    const res = await saveResource(user, { ...base, blobPathname: await stagePdf(user.id), acceptedRights: true });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/awaiting review/) });
  });

  describe("editing", () => {
    it("lets admins edit anything, keeping its status, and replaces the old file", async () => {
      const admin = await createUser({ role: "admin" });
      const r = await createResource({ blob_pathname: "docs/old/x.pdf" });
      blobStore.set("docs/old/x.pdf", new Uint8Array([1]));
      const res = await saveResource(admin, { ...base, id: r.id, title: "Renamed", blobPathname: await stagePdf(admin.id, "new.pdf") });
      expect(res).toMatchObject({ ok: true, status: "published", slug: r.slug });
      expect((await row(r.id)).title).toBe("Renamed");
      expect(blobStore.has("docs/old/x.pdf")).toBe(false);
    });

    it("lets contributors edit their own rejected submission, sending it back to the queue", async () => {
      const user = await createUser();
      const r = await createResource({ uploaded_by: user.id, status: "rejected" });
      await dbModule.sql(`UPDATE resource SET rejection_reason = 'blurry' WHERE id = $1`, [r.id]);
      const res = await saveResource(user, { ...base, id: r.id });
      expect(res).toMatchObject({ ok: true, status: "pending" });
      expect(await row(r.id)).toMatchObject({ status: "pending", rejection_reason: null });
    });

    it("stops contributors editing published or other people's resources", async () => {
      const user = await createUser();
      const other = await createUser();
      const published = await createResource({ uploaded_by: user.id, status: "published" });
      const theirs = await createResource({ uploaded_by: other.id, status: "pending" });
      expect(await saveResource(user, { ...base, id: published.id })).toEqual({ ok: false, error: "You can't edit this resource" });
      expect(await saveResource(user, { ...base, id: theirs.id })).toEqual({ ok: false, error: "You can't edit this resource" });
    });

    it("reports unknown resources", async () => {
      const admin = await createUser({ role: "admin" });
      expect(await saveResource(admin, { ...base, id: "00000000-0000-0000-0000-000000000000" })).toEqual({ ok: false, error: "Resource not found" });
    });
  });

  it("rethrows unexpected errors", async () => {
    const admin = await createUser({ role: "admin" });
    const spy = vi.spyOn(dbModule, "sql").mockRejectedValueOnce(new Error("db down"));
    await expect(saveResource(admin, { ...base, id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow("db down");
    spy.mockRestore();
  });
});

describe("deleteResource", () => {
  beforeEach(resetDb);

  it("admins can delete anything (and its files)", async () => {
    const admin = await createUser({ role: "admin" });
    const r = await createResource({ blob_pathname: "docs/x/1.pdf", thumb_pathname: "thumbs/x/1.webp" });
    blobStore.set("docs/x/1.pdf", new Uint8Array([1]));
    blobStore.set("thumbs/x/1.webp", new Uint8Array([1]));
    expect(await deleteResource(admin, r.id)).toEqual({ ok: true });
    expect(await row(r.id)).toBeUndefined();
    expect(blobStore.size).toBe(0);
  });

  it("contributors can withdraw only their own unpublished submissions", async () => {
    const user = await createUser();
    const mine = await createResource({ uploaded_by: user.id, status: "pending" });
    const live = await createResource({ uploaded_by: user.id, status: "published" });
    expect(await deleteResource(user, mine.id)).toEqual({ ok: true });
    expect(await deleteResource(user, live.id)).toEqual({ ok: false, error: "You can't delete this resource" });
  });

  it("reports unknown resources", async () => {
    const admin = await createUser({ role: "admin" });
    expect(await deleteResource(admin, "not-a-uuid")).toEqual({ ok: false, error: "Resource not found" });
  });
});

describe("decideResource (approval queue)", () => {
  beforeEach(resetDb);

  it("approves pending resources", async () => {
    const admin = await createUser({ role: "admin" });
    const r = await createResource({ status: "pending" });
    expect(await decideResource(admin, r.id, "approve")).toEqual({ ok: true });
    expect(await row(r.id)).toMatchObject({ status: "published", reviewed_by: admin.id });
  });

  it("rejects with a required reason", async () => {
    const admin = await createUser({ role: "admin" });
    const r = await createResource({ status: "pending" });
    expect(await decideResource(admin, r.id, "reject", "  ")).toEqual({ ok: false, error: expect.stringMatching(/reason/) });
    expect(await decideResource(admin, r.id, "reject", "Copyrighted images")).toEqual({ ok: true });
    expect(await row(r.id)).toMatchObject({ status: "rejected", rejection_reason: "Copyrighted images" });
  });

  it("is admin-only and only for pending items", async () => {
    const admin = await createUser({ role: "admin" });
    const user = await createUser();
    const pending = await createResource({ status: "pending" });
    const live = await createResource();
    expect(await decideResource(user, pending.id, "approve")).toEqual({ ok: false, error: "Not authorised" });
    expect(await decideResource(admin, live.id, "approve")).toEqual({ ok: false, error: expect.stringMatching(/isn't awaiting/) });
    expect(await decideResource(admin, "00000000-0000-0000-0000-000000000000", "approve")).toEqual({ ok: false, error: "Resource not found" });
  });
});

describe("cleanupUserData (account deletion)", () => {
  beforeEach(resetDb);

  it("removes unpublished submissions and their files but keeps published ones", async () => {
    const user = await createUser();
    const pending = await createResource({ uploaded_by: user.id, status: "pending", blob_pathname: "docs/u/p.pdf" });
    const live = await createResource({ uploaded_by: user.id, status: "published" });
    blobStore.set("docs/u/p.pdf", new Uint8Array([1]));
    expect(await cleanupUserData(user.id)).toBe(1);
    expect(await row(pending.id)).toBeUndefined();
    expect(await row(live.id)).toBeDefined();
    expect(blobStore.has("docs/u/p.pdf")).toBe(false);
  });
});
