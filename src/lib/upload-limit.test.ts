import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, dbModule, resetDb } from "../../test/pglite";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);
const { allowUploadToken, UPLOAD_TOKENS_PER_HOUR } = await import("./upload-limit");

describe("allowUploadToken", () => {
  beforeEach(resetDb);

  it("allows up to the hourly limit, then refuses", async () => {
    const u = await createUser();
    await dbModule.sql(
      `INSERT INTO upload_token (user_id) SELECT $1, g FROM generate_series(1, $2) g`.replace(", g FROM", " FROM"),
      [u.id, UPLOAD_TOKENS_PER_HOUR - 1],
    );
    expect(await allowUploadToken(u)).toBe(true);
    expect(await allowUploadToken(u)).toBe(false);
  });

  it("only counts the last hour", async () => {
    const u = await createUser();
    await dbModule.sql(
      `INSERT INTO upload_token (user_id, created_at) SELECT $1, now() - interval '2 hours' FROM generate_series(1, $2)`,
      [u.id, UPLOAD_TOKENS_PER_HOUR],
    );
    expect(await allowUploadToken(u)).toBe(true);
  });

  it("admins are not limited and aren't logged", async () => {
    const admin = await createUser({ role: "admin" });
    expect(await allowUploadToken(admin)).toBe(true);
    const [{ n }] = await dbModule.sql(`SELECT count(*)::int AS n FROM upload_token`);
    expect(n).toBe(0);
  });
});
