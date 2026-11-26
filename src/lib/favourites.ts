import "server-only";
import { sql } from "./db";
import type { Actor } from "./resource-service";

export async function toggleFavourite(actor: Actor, resourceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(resourceId)) return { ok: false as const, error: "Resource not found" };
  const removed = await sql(`DELETE FROM favourite WHERE user_id = $1 AND resource_id = $2 RETURNING 1`, [actor.id, resourceId]);
  if (removed.length) return { ok: true as const, favourite: false };
  const added = await sql(
    `INSERT INTO favourite (user_id, resource_id)
     SELECT $1, id FROM resource WHERE id = $2 AND status = 'published'
     ON CONFLICT DO NOTHING RETURNING 1`,
    [actor.id, resourceId],
  );
  if (!added.length) return { ok: false as const, error: "Resource not found" };
  return { ok: true as const, favourite: true };
}
