// Applies db/schema.sql (idempotent). Better Auth tables come from `npx auth migrate`.
// Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
await client.query(schema);

// Optional one-off: promote an existing account to admin.
if (process.env.PROMOTE_ADMIN_EMAIL) {
  const res = await client.query(`UPDATE "user" SET role = 'admin' WHERE lower(email) = lower($1) RETURNING email`, [
    process.env.PROMOTE_ADMIN_EMAIL,
  ]);
  console.log(res.rowCount ? `Promoted ${res.rows[0].email} to admin.` : "No account with that email.");
}
console.log("Schema up to date.");
await client.end();
