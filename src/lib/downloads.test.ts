import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../test/pglite";

vi.mock("@/lib/db", async () => (await import("../../test/pglite")).dbModule);
vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);

const { authoriseDownload, getQuota, DAILY_DOWNLOAD_LIMIT } = await import("./downloads");

describe("daily download limit", () => {
  beforeEach(resetDb);

  it("is 5 per day", () => expect(DAILY_DOWNLOAD_LIMIT).toBe(5));

  it("allows 5 different resources, then blocks the 6th", async () => {
    const user = await createUser();
    const res = await Promise.all(Array.from({ length: 6 }, () => createResource()));
    for (let i = 0; i < 5; i++) {
      const r = await authoriseDownload(user, res[i].id);
      expect(r.allowed).toBe(true);
      expect(r.quota.remaining).toBe(4 - i);
    }
    const blocked = await authoriseDownload(user, res[5].id);
    expect(blocked.allowed).toBe(false);
    expect(blocked.quota.remaining).toBe(0);
  });

  it("re-downloading the same resource on the same day is free", async () => {
    const user = await createUser();
    const r = await createResource();
    await authoriseDownload(user, r.id);
    await authoriseDownload(user, r.id);
    const q = await getQuota(user);
    expect(q.used).toBe(1);
    expect(q.resourceIds).toEqual([r.id]);
  });

  it("still allows re-downloading today's resources after hitting the limit", async () => {
    const user = await createUser();
    const res = await Promise.all(Array.from({ length: 5 }, () => createResource()));
    for (const r of res) await authoriseDownload(user, r.id);
    expect((await authoriseDownload(user, res[0].id)).allowed).toBe(true);
  });

  it("only counts today's downloads (NZ time)", async () => {
    const user = await createUser();
    const res = await Promise.all(Array.from({ length: 5 }, () => createResource()));
    for (const r of res) {
      await dbModule.sql(`INSERT INTO download (user_id, resource_id, created_at) VALUES ($1, $2, now() - interval '2 days')`, [user.id, r.id]);
    }
    expect((await getQuota(user)).remaining).toBe(5);
  });

  it("admins are unlimited", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await Promise.all(Array.from({ length: 7 }, () => createResource()));
    for (const r of res) expect((await authoriseDownload(admin, r.id)).allowed).toBe(true);
    const q = await getQuota(admin);
    expect(q.unlimited).toBe(true);
    expect(q.remaining).toBe(Infinity);
  });

  it("counts each user's download of a resource once per day", async () => {
    const user = await createUser();
    const other = await createUser();
    const r = await createResource();
    await authoriseDownload(user, r.id);
    await authoriseDownload(user, r.id);
    await authoriseDownload(other, r.id);
    const [row] = await dbModule.sql(`SELECT download_count FROM resource WHERE id = $1`, [r.id]);
    expect(row.download_count).toBe(2);
    const [{ n }] = await dbModule.sql(`SELECT count(*)::int AS n FROM download`);
    expect(n).toBe(2);
  });

  it("can't be raced past the limit with parallel requests", async () => {
    const user = await createUser();
    const res = await Promise.all(Array.from({ length: 12 }, () => createResource()));
    const results = await Promise.all(res.map((r) => authoriseDownload(user, r.id)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect((await getQuota(user)).used).toBe(5);
  });
});
