import "server-only";
import { withTransaction } from "./db";

/**
 * Each resource needs 1 PDF + 1 thumbnail + up to 20 preview images, so 120/hour
 * comfortably covers several uploads while stopping storage-filling scripts.
 */
export const UPLOAD_TOKENS_PER_HOUR = 120;

export async function allowUploadToken(user: { id: string; isAdmin: boolean }) {
  if (user.isAdmin) return true;
  return withTransaction(async (q) => {
    await q(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`upload:${user.id}`]);
    const [{ n }] = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM upload_token WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
      [user.id],
    );
    if (n >= UPLOAD_TOKENS_PER_HOUR) return false;
    await q(`INSERT INTO upload_token (user_id) VALUES ($1)`, [user.id]);
    return true;
  });
}
