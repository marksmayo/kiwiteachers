import "server-only";
import { Pool, type QueryResultRow } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5000,
  });

if (!globalForPool.pgPool) {
  globalForPool.pgPool = pool;
  attachDatabasePool(pool);
}

export async function sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export type TxQuery = <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<T[]>;

/** Runs `fn` in a single transaction on one connection; rolls back on error. */
export async function withTransaction<R>(fn: (q: TxQuery) => Promise<R>): Promise<R> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
