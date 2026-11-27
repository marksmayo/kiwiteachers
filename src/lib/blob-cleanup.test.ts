import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../test/pglite";
import { blobModule, blobStore, blobUploadedAt } from "../../test/blob-mock";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);
vi.mock("@vercel/blob", async () => (await import("../../test/blob-mock")).blobModule);

const { cleanupOrphanBlobs, pruneRateLimitRows } = await import("./blob-cleanup");

const NOW = new Date("2026-11-27T12:00:00Z");
const OLD = new Date("2026-11-25T12:00:00Z");
const add = (p: string, at = OLD) => {
  blobStore.set(p, new Uint8Array([1]));
  blobUploadedAt.set(p, at);
};

describe("cleanupOrphanBlobs", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
    blobUploadedAt.clear();
  });

  it("deletes old uploads nothing refers to, and keeps everything else", async () => {
    const r = await createResource({ blob_pathname: "docs/u/a.pdf", thumb_pathname: "thumbs/u/a.webp" });
    await dbModule.sql(`UPDATE resource SET preview_pathnames = $2 WHERE id = $1`, [r.id, ["previews/u/a-1.webp"]]);
    for (const p of ["docs/u/a.pdf", "thumbs/u/a.webp", "previews/u/a-1.webp"]) add(p);
    add("docs/u/abandoned.pdf");
    add("thumbs/u/abandoned.webp");
    add("previews/u/stray-1.webp");
    add("docs/u/in-progress.pdf", new Date(NOW.getTime() - 60_000));
    add("other/keep.txt");

    const report = await cleanupOrphanBlobs({ now: NOW });
    expect([...report.deleted].sort()).toEqual(["docs/u/abandoned.pdf", "previews/u/stray-1.webp", "thumbs/u/abandoned.webp"]);
    expect(report.scanned).toBe(7);
    expect([...blobStore.keys()].sort()).toEqual([
      "docs/u/a.pdf",
      "docs/u/in-progress.pdf",
      "other/keep.txt",
      "previews/u/a-1.webp",
      "thumbs/u/a.webp",
    ]);
  });

  it("only reports in dry-run mode", async () => {
    add("docs/u/abandoned.pdf");
    const report = await cleanupOrphanBlobs({ now: NOW, dryRun: true });
    expect(report).toMatchObject({ dryRun: true, orphaned: 1, deleted: ["docs/u/abandoned.pdf"] });
    expect(blobStore.has("docs/u/abandoned.pdf")).toBe(true);
  });

  it("pages through large stores and caps deletions per run", async () => {
    for (let i = 0; i < 1205; i++) add(`docs/u/${String(i).padStart(4, "0")}.pdf`);
    const report = await cleanupOrphanBlobs({ now: NOW, maxDeletes: 1100 });
    expect(report.scanned).toBe(1205);
    expect(report.orphaned).toBe(1205);
    expect(report.deleted).toHaveLength(1100);
    expect(report.capped).toBe(true);
    expect(blobStore.size).toBe(105);
  });

  it("keeps a file that a resource claims while the store is being listed", async () => {
    add("docs/u/late.pdf");
    const realList = blobModule.list;
    const spy = vi.spyOn(blobModule, "list").mockImplementation(async (opts) => {
      const page = await realList(opts);
      if (opts?.prefix === "previews/") await createResource({ blob_pathname: "docs/u/late.pdf" });
      return page;
    });
    const report = await cleanupOrphanBlobs({ now: NOW });
    spy.mockRestore();
    expect(report.deleted).toEqual([]);
    expect(blobStore.has("docs/u/late.pdf")).toBe(true);
  });

  it("does nothing on an empty store", async () => {
    expect(await cleanupOrphanBlobs({ now: NOW })).toMatchObject({ scanned: 0, orphaned: 0, deleted: [] });
  });
});

describe("pruneRateLimitRows", () => {
  beforeEach(resetDb);
  it("drops upload-token rows older than two days", async () => {
    const u = await createUser();
    await dbModule.sql(`INSERT INTO upload_token (user_id, created_at) VALUES ($1, now() - interval '3 days'), ($1, now())`, [u.id]);
    expect(await pruneRateLimitRows()).toBe(1);
  });
});
