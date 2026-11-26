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

export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}
