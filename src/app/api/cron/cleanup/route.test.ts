import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../../../../../test/pglite";
import { blobStore, blobUploadedAt } from "../../../../../test/blob-mock";

vi.mock("@/lib/db", async () => (await import("../../../../../test/pglite")).dbModule);
vi.mock("@vercel/blob", async () => (await import("../../../../../test/blob-mock")).blobModule);

const route = await import("./route");
const SECRET = "test-cron-secret-1234";
const call = (auth?: string, qs = "") =>
  route.POST(new Request(`http://localhost/api/cron/cleanup${qs}`, { method: "POST", headers: auth ? { authorization: auth } : {} }));

describe("/api/cron/cleanup", () => {
  beforeEach(async () => {
    await resetDb();
    blobStore.clear();
    process.env.CRON_SECRET = SECRET;
    blobStore.set("docs/u/old.pdf", new Uint8Array([1]));
    blobUploadedAt.set("docs/u/old.pdf", new Date(Date.now() - 3 * 86_400_000));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("rejects callers without the secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(blobStore.size).toBe(1);
  });

  it("supports a dry run", async () => {
    const res = await call(`Bearer ${SECRET}`, "?dryRun=1");
    expect(await res.json()).toMatchObject({ dryRun: true, orphaned: 1, deleted: 1 });
    expect(blobStore.size).toBe(1);
  });

  it("cleans up when called by the scheduler", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deleted: 1, deletedPaths: ["docs/u/old.pdf"], views: 0, uploadTokens: 0 });
    expect(blobStore.size).toBe(0);
    expect(route.GET).toBe(route.POST);
  });
});
