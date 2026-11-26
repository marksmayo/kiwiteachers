import "server-only";
import { sql, withTransaction, type TxQuery } from "./db";
import { DAILY_DOWNLOAD_LIMIT } from "./download-limit";

export { DAILY_DOWNLOAD_LIMIT };

/** Start of "today" in New Zealand time, so the allowance resets at NZ midnight. */
const NZ_TODAY = `(date_trunc('day', now() AT TIME ZONE 'Pacific/Auckland') AT TIME ZONE 'Pacific/Auckland')`;

export type Quota = { used: number; limit: number; remaining: number; resourceIds: string[]; unlimited: boolean };

async function quotaWith(q: TxQuery, user: { id: string; isAdmin: boolean }): Promise<Quota> {
  const rows = await q<{ resource_id: string }>(
    `SELECT DISTINCT resource_id FROM download WHERE user_id = $1 AND created_at >= ${NZ_TODAY}`,
    [user.id],
  );
  const resourceIds = rows.map((r) => r.resource_id);
  const used = resourceIds.length;
  return {
    used,
    limit: DAILY_DOWNLOAD_LIMIT,
    remaining: user.isAdmin ? Infinity : Math.max(0, DAILY_DOWNLOAD_LIMIT - used),
    resourceIds,
    unlimited: user.isAdmin,
  };
}

export function getQuota(user: { id: string; isAdmin: boolean }) {
  return quotaWith(sql, user);
}

/**
 * Checks the daily allowance and records the download if allowed. Runs under a
 * per-user advisory lock so parallel requests can't race past the limit.
 * Re-downloading a resource already downloaded today is free and isn't re-counted.
 */
export async function authoriseDownload(
  user: { id: string; isAdmin: boolean },
  resourceId: string,
): Promise<{ allowed: boolean; quota: Quota }> {
  return withTransaction(async (q) => {
    await q(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`download:${user.id}`]);
    const quota = await quotaWith(q, user);
    if (quota.resourceIds.includes(resourceId)) return { allowed: true, quota };
    if (!user.isAdmin && quota.remaining <= 0) return { allowed: false, quota };

    await q(`INSERT INTO download (user_id, resource_id) VALUES ($1, $2)`, [user.id, resourceId]);
    await q(`UPDATE resource SET download_count = download_count + 1 WHERE id = $1`, [resourceId]);
    return { allowed: true, quota: await quotaWith(q, user) };
  });
}
