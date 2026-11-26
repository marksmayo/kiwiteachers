import { describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const client = {
  query: vi.fn(async (text: string) => {
    calls.push(text);
    if (text === "FAIL") throw new Error("boom");
    return { rows: [{ text }] };
  }),
  release: vi.fn(),
};
vi.mock("pg", () => ({
  Pool: vi.fn(function Pool() {
    return { query: vi.fn(async () => ({ rows: [{ one: 1 }] })), connect: vi.fn(async () => client) };
  }),
}));
vi.mock("@vercel/functions", () => ({ attachDatabasePool: vi.fn() }));

const { sql, withTransaction, pool } = await import("./db");

describe("db", () => {
  it("creates a single shared pool", async () => {
    expect(pool).toBeDefined();
    expect((await import("./db")).pool).toBe(pool);
  });

  it("sql returns rows", async () => {
    expect(await sql("SELECT 1")).toEqual([{ one: 1 }]);
  });

  it("withTransaction commits on success and releases the client", async () => {
    calls.length = 0;
    const out = await withTransaction(async (q) => (await q("SELECT x"))[0]);
    expect(out).toEqual({ text: "SELECT x" });
    expect(calls).toEqual(["BEGIN", "SELECT x", "COMMIT"]);
    expect(client.release).toHaveBeenCalled();
  });

  it("withTransaction rolls back and rethrows on error", async () => {
    calls.length = 0;
    await expect(withTransaction((q) => q("FAIL"))).rejects.toThrow("boom");
    expect(calls).toEqual(["BEGIN", "FAIL", "ROLLBACK"]);
    expect(client.release).toHaveBeenCalled();
  });
});
