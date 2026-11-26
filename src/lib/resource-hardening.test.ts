import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../test/pglite";
import { blobStore } from "../../test/blob-mock";
import { makePdf, WEBP_BYTES } from "../../test/pdf-fixtures";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);
vi.mock("@vercel/blob", async () => (await import("../../test/blob-mock")).blobModule);

const { saveResource, deleteResource, cleanupUserData } = await import("./resource-service");
const { writeReview, moderateReview, listReviews } = await import("./reviews");

const base = { title: "Kiwi counting", description: "", years: [1], learningAreas: ["maths"], resourceType: "worksheet", tags: [] };
const bySlug = async (slug: string) => (await dbModule.sql(`SELECT * FROM resource WHERE slug = $1`, [slug]))[0];

async function stage(path: string, bytes?: Uint8Array) {
  blobStore.set(path, bytes ?? (await makePdf(2)));
  return path;
}

describe("uploads are sanitised and never shared", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
  });

  it("stores a rebuilt copy and deletes the raw upload", async () => {
    const admin = await createUser({ role: "admin" });
    const raw = await stage(`docs/${admin.id}/raw.pdf`);
    const res = await saveResource(admin, { ...base, blobPathname: raw });
    const row = await bySlug((res as { slug: string }).slug);
    expect(row.blob_pathname).toMatch(new RegExp(`^docs/${admin.id}/clean-.+\\.pdf$`));
    expect(blobStore.has(raw)).toBe(false);
    expect(blobStore.has(row.blob_pathname)).toBe(true);
  });

  it("refuses to attach a file that another resource already uses", async () => {
    const user = await createUser();
    const live = await createResource({ uploaded_by: user.id, blob_pathname: `docs/${user.id}/live.pdf` });
    await stage(`docs/${user.id}/live.pdf`);
    const res = await saveResource(user, { ...base, blobPathname: `docs/${user.id}/live.pdf`, acceptedRights: true });
    expect(res).toEqual({ ok: false, error: "Invalid file" });
    expect(blobStore.has(`docs/${user.id}/live.pdf`)).toBe(true);
    expect(await deleteResource(user, live.id)).toEqual({ ok: false, error: "You can't delete this resource" });
  });

  it("re-sending the current file on edit is a no-op, not a delete", async () => {
    const admin = await createUser({ role: "admin" });
    const r = await createResource({ blob_pathname: "docs/x/keep.pdf" });
    await stage("docs/x/keep.pdf");
    expect((await saveResource(admin, { ...base, id: r.id, blobPathname: "docs/x/keep.pdf" })).ok).toBe(true);
    expect(blobStore.has("docs/x/keep.pdf")).toBe(true);
  });
});

describe("preview images", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
  });

  it("stores a full, valid set (one image per page)", async () => {
    const admin = await createUser({ role: "admin" });
    const previews = [`previews/${admin.id}/p1.webp`, `previews/${admin.id}/p2.webp`];
    previews.forEach((p) => blobStore.set(p, WEBP_BYTES));
    const res = await saveResource(admin, { ...base, blobPathname: await stage(`docs/${admin.id}/a.pdf`), previewPathnames: previews });
    expect((await bySlug((res as { slug: string }).slug)).preview_pathnames).toEqual(previews);
  });

  it.each([
    ["wrong count", (id: string) => [`previews/${id}/p1.webp`]],
    ["duplicates", (id: string) => [`previews/${id}/p1.webp`, `previews/${id}/p1.webp`]],
    ["someone else's folder", (id: string) => [`previews/${id}/p1.webp`, `previews/other/p2.webp`]],
  ])("drops and deletes an invalid set: %s", async (_label, make) => {
    const admin = await createUser({ role: "admin" });
    const previews = make(admin.id);
    previews.forEach((p) => blobStore.set(p, WEBP_BYTES));
    const res = await saveResource(admin, { ...base, blobPathname: await stage(`docs/${admin.id}/a.pdf`), previewPathnames: previews });
    expect((await bySlug((res as { slug: string }).slug)).preview_pathnames).toEqual([]);
    expect(blobStore.has(`previews/${admin.id}/p1.webp`)).toBe(false);
    if (previews.some((p) => p.includes("other"))) expect(blobStore.has("previews/other/p2.webp")).toBe(true);
  });

  it("drops a set containing a non-image", async () => {
    const admin = await createUser({ role: "admin" });
    const previews = [`previews/${admin.id}/p1.webp`, `previews/${admin.id}/p2.webp`];
    blobStore.set(previews[0], WEBP_BYTES);
    blobStore.set(previews[1], new TextEncoder().encode("<html>"));
    const res = await saveResource(admin, { ...base, blobPathname: await stage(`docs/${admin.id}/a.pdf`), previewPathnames: previews });
    expect((await bySlug((res as { slug: string }).slug)).preview_pathnames).toEqual([]);
  });

  it("regenerates previews on edit and removes the old ones; a new file without previews clears them", async () => {
    const admin = await createUser({ role: "admin" });
    const r = await createResource({ blob_pathname: "docs/x/a.pdf" });
    await dbModule.sql(`UPDATE resource SET page_count = 1, preview_pathnames = '{previews/old/p1.webp}' WHERE id = $1`, [r.id]);
    blobStore.set("previews/old/p1.webp", WEBP_BYTES);
    const fresh = `previews/${admin.id}/p1.webp`;
    blobStore.set(fresh, WEBP_BYTES);
    await saveResource(admin, { ...base, id: r.id, previewPathnames: [fresh] });
    expect((await bySlug(r.slug)).preview_pathnames).toEqual([fresh]);
    expect(blobStore.has("previews/old/p1.webp")).toBe(false);

    await saveResource(admin, { ...base, id: r.id, blobPathname: await stage(`docs/${admin.id}/new.pdf`) });
    expect((await bySlug(r.slug)).preview_pathnames).toEqual([]);
    expect(blobStore.has(fresh)).toBe(false);
  });

  it("deleting a resource or an account removes its previews", async () => {
    const user = await createUser();
    const admin = await createUser({ role: "admin" });
    const a = await createResource({ uploaded_by: user.id, status: "pending" });
    const b = await createResource();
    await dbModule.sql(`UPDATE resource SET preview_pathnames = '{previews/u/a1.webp}' WHERE id = $1`, [a.id]);
    await dbModule.sql(`UPDATE resource SET preview_pathnames = '{previews/u/b1.webp}' WHERE id = $1`, [b.id]);
    blobStore.set("previews/u/a1.webp", WEBP_BYTES);
    blobStore.set("previews/u/b1.webp", WEBP_BYTES);
    await cleanupUserData(user.id);
    await deleteResource(admin, b.id);
    expect(blobStore.size).toBe(0);
  });
});

describe("admin 'hide' is sticky", () => {
  beforeEach(resetDb);

  it("a hidden review goes back to the queue when edited, even if the new text is clean", async () => {
    const admin = await createUser({ role: "admin" });
    const u = await createUser();
    const r = await createResource();
    await writeReview(u, r.id, { score: 3, body: "A perfectly fine review the admin disliked" });
    await moderateReview(admin, u.id, r.id, "hide");
    const res = await writeReview(u, r.id, { score: 3, body: "Same review, resubmitted to get around moderation" });
    expect(res).toMatchObject({ ok: true, status: "flagged" });
    expect(await listReviews(r.id, null)).toHaveLength(0);
  });
});
