import { describe, expect, it } from "vitest";
import { getDb, dbModule, createUser, createResource } from "./pglite";

describe("pglite harness", () => {
  it("loads the real schema incl. rating trigger, tsvector and NZ timezone", async () => {
    await getDb();
    const u = await createUser();
    const r = await createResource({ title: "Matariki fractions", tags: ["matariki"] });
    await dbModule.sql(`INSERT INTO rating (user_id, resource_id, score) VALUES ($1, $2, 4.5)`, [u.id, r.id]);
    const [row] = await dbModule.sql(
      `SELECT rating_avg::float AS a, rating_count AS c, search @@ to_tsquery('english','matariki') AS hit FROM resource WHERE id=$1`,
      [r.id],
    );
    expect(row).toEqual({ a: 4.5, c: 1, hit: true });
    const [tz] = await dbModule.sql(
      `SELECT (date_trunc('day', now() AT TIME ZONE 'Pacific/Auckland') AT TIME ZONE 'Pacific/Auckland') IS NOT NULL AS ok`,
    );
    expect(tz.ok).toBe(true);
  });
});
