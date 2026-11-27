import { del, list } from "@vercel/blob";
import { sql } from "./db";

/** Folders the app writes to. Anything else in the store is left alone. */
export const UPLOAD_PREFIXES = ["docs/", "thumbs/", "previews/"] as const;
/** Uploads younger than this may belong to a form that hasn't been saved yet. */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
/** A safety valve: a single run never deletes more than this. */
export const MAX_DELETES_PER_RUN = 1000;

const CLAIMED_SQL = `
  SELECT blob_pathname AS p FROM resource
  UNION SELECT thumb_pathname FROM resource WHERE thumb_pathname IS NOT NULL
  UNION SELECT unnest(preview_pathnames) FROM resource`;

export type CleanupReport = { scanned: number; orphaned: number; deleted: string[]; dryRun: boolean; capped: boolean };

/**
 * Deletes uploads that no resource refers to: files from abandoned upload forms, raw uploads left behind
 * by a failed save, and stray previews. Fresh uploads (inside the grace period) are kept.
 */
export async function cleanupOrphanBlobs(
  opts: { now?: Date; dryRun?: boolean; graceMs?: number; maxDeletes?: number } = {},
): Promise<CleanupReport> {
  const now = opts.now ?? new Date();
  const grace = opts.graceMs ?? ORPHAN_GRACE_MS;
  const max = opts.maxDeletes ?? MAX_DELETES_PER_RUN;

  const claimed = new Set((await sql<{ p: string }>(CLAIMED_SQL)).map((r) => r.p));
  const candidates: string[] = [];
  let scanned = 0;
  for (const prefix of UPLOAD_PREFIXES) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const b of page.blobs) {
        scanned++;
        if (!claimed.has(b.pathname) && now.getTime() - new Date(b.uploadedAt).getTime() > grace) candidates.push(b.pathname);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }

  // Re-check just before deleting, in case a resource claimed one of these while we were listing.
  const stillClaimed = candidates.length
    ? new Set((await sql<{ p: string }>(`SELECT p FROM (${CLAIMED_SQL}) c WHERE p = ANY($1)`, [candidates])).map((r) => r.p))
    : new Set<string>();
  const orphans = candidates.filter((p) => !stillClaimed.has(p));
  const toDelete = orphans.slice(0, max);

  if (!opts.dryRun) {
    for (let i = 0; i < toDelete.length; i += 100) await del(toDelete.slice(i, i + 100));
  }
  return { scanned, orphaned: orphans.length, deleted: toDelete, dryRun: !!opts.dryRun, capped: orphans.length > max };
}

/** Old rows that only exist to enforce short rate-limit windows. */
export async function pruneRateLimitRows() {
  const tokens = await sql(`DELETE FROM upload_token WHERE created_at < now() - interval '2 days' RETURNING 1`);
  return tokens.length;
}
