import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

/** Minimal Better Auth "user" table so app tables can reference it. */
const USER_SQL = `
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);`;

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

let db: PGlite | null = null;

export async function getDb() {
  if (!db) {
    db = await PGlite.create({ extensions: { pg_trgm } });
    await db.exec(`SET TIME ZONE 'Pacific/Auckland';`);
    await db.exec(USER_SQL);
    await db.exec(schema);
  }
  return db;
}

/** Drop-in replacement for src/lib/db.ts */
export const dbModule = {
  pool: {},
  // Rows are loosely typed in tests; production code types them at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: async (text: string, params: unknown[] = []): Promise<any[]> => {
    const res = await (await getDb()).query(text, params as unknown[]);
    return res.rows;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withTransaction: async <R>(fn: (q: (text: string, params?: unknown[]) => Promise<any[]>) => Promise<R>): Promise<R> =>
    (await getDb()).transaction((tx) => fn(async (text, params = []) => (await tx.query(text, params as unknown[])).rows)),
};

export async function resetDb() {
  const d = await getDb();
  await d.exec(`TRUNCATE resource_view, upload_token, download, favourite, rating, resource, "user" RESTART IDENTITY CASCADE;`);
}

let n = 0;
export async function createUser(opts: { name?: string; email?: string; role?: string } = {}) {
  n++;
  const id = `user-${n}-${Math.random().toString(36).slice(2, 8)}`;
  await dbModule.sql(`INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)`, [
    id,
    opts.name ?? `Teacher ${n}`,
    opts.email ?? `${id}@example.com`,
    opts.role ?? "user",
  ]);
  return { id, isAdmin: opts.role === "admin" };
}

export type ResourceSeed = Partial<{
  slug: string;
  title: string;
  description: string;
  status: string;
  years: number[];
  learning_areas: string[];
  resource_type: string;
  tags: string[];
  curriculum_codes: string[];
  uploaded_by: string | null;
  blob_pathname: string;
  thumb_pathname: string | null;
}>;

export async function createResource(seed: ResourceSeed = {}) {
  n++;
  const rows = await dbModule.sql(
    `INSERT INTO resource (slug, title, description, status, years, learning_areas, resource_type, tags, curriculum_codes, uploaded_by, blob_pathname, thumb_pathname)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, slug`,
    [
      seed.slug ?? `res-${n}`,
      seed.title ?? `Resource ${n}`,
      seed.description ?? "",
      seed.status ?? "published",
      seed.years ?? [4],
      seed.learning_areas ?? ["maths"],
      seed.resource_type ?? "worksheet",
      seed.tags ?? [],
      seed.curriculum_codes ?? [],
      seed.uploaded_by ?? null,
      seed.blob_pathname ?? `docs/seed/${n}.pdf`,
      seed.thumb_pathname ?? null,
    ],
  );
  return rows[0] as { id: string; slug: string };
}
