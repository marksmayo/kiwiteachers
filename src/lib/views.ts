import { createHash } from "node:crypto";
import { sql, withTransaction } from "./db";

/** Limits on counted views per NZ day. Further views still load; they just don't count. */
export const VIEW_LIMITS = {
  /** Distinct resources one viewer (account, or IP + browser) can add a view to. */
  perViewer: 60,
  /** Views one IP address can add in total (schools share an IP, so this is generous). */
  perSource: 400,
  /** Views one IP address can add to a single resource, however many browsers it claims to be. */
  perSourcePerResource: 15,
};

const BOT_UA =
  /bot|crawl|spider|slurp|archiver|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|scrapy|postman|insomnia/i;

/** Crawlers, link unfurlers and HTTP libraries don't count. A missing user agent doesn't either. */
export function isLikelyBot(userAgent: string | null | undefined) {
  return !userAgent || userAgent.length < 10 || BOT_UA.test(userAgent);
}

/** The beacon is only sent by our own pages, so cross-site and non-browser-shaped requests are ignored. */
export function isSameOriginRequest(headers: Headers, host: string | null) {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = headers.get("origin");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** NZ calendar date, e.g. "2026-11-27". */
export function nzDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now);
}

function digest(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u0000")).digest("base64url").slice(0, 32);
}

/**
 * Identifies a viewer without storing personal data: signed-in users by id, everyone else by a hash of
 * IP + browser salted with the server secret and today's date, so hashes can't be reversed or linked across days.
 */
export function viewerIdentity(opts: { userId?: string | null; ip: string; userAgent: string; secret: string; day: string }) {
  const source = `s:${digest(opts.secret, opts.day, opts.ip)}`;
  const viewer = opts.userId ? `u:${opts.userId}` : `a:${digest(opts.secret, opts.day, opts.ip, opts.userAgent)}`;
  return { viewer, source };
}

export type ViewResult = { counted: boolean; reason?: "duplicate" | "limit" | "not-countable" };

/**
 * Counts a view at most once per viewer per resource per NZ day, within the VIEW_LIMITS caps.
 * Unpublished resources, admins and the resource's own uploader aren't counted.
 */
export async function recordView(
  resourceId: string,
  who: { viewer: string; source: string; userId?: string | null; isAdmin?: boolean },
  day = nzDay(),
): Promise<ViewResult> {
  if (who.isAdmin) return { counted: false, reason: "not-countable" };
  return withTransaction(async (q): Promise<ViewResult> => {
    // Serialise per IP so parallel requests can't slip past the caps.
    await q(`SELECT pg_advisory_xact_lock(hashtext($1))`, [who.source]);
    const [res] = await q(
      `SELECT 1 FROM resource WHERE id = $1 AND status = 'published' AND ($2::text IS NULL OR uploaded_by IS DISTINCT FROM $2)`,
      [resourceId, who.userId ?? null],
    );
    if (!res) return { counted: false, reason: "not-countable" };
    const [c] = await q(
      `SELECT
         EXISTS (SELECT 1 FROM resource_view WHERE resource_id = $4 AND viewer = $2 AND day = $1) AS seen,
         (SELECT count(*) FROM resource_view WHERE day = $1 AND viewer = $2)::int AS by_viewer,
         (SELECT count(*) FROM resource_view WHERE day = $1 AND source = $3)::int AS by_source,
         (SELECT count(*) FROM resource_view WHERE day = $1 AND source = $3 AND resource_id = $4)::int AS by_source_resource`,
      [day, who.viewer, who.source, resourceId],
    );
    if (c.seen) return { counted: false, reason: "duplicate" };
    if (
      c.by_viewer >= VIEW_LIMITS.perViewer ||
      c.by_source >= VIEW_LIMITS.perSource ||
      c.by_source_resource >= VIEW_LIMITS.perSourcePerResource
    ) {
      return { counted: false, reason: "limit" };
    }
    await q(`INSERT INTO resource_view (resource_id, viewer, source, day) VALUES ($1, $2, $3, $4)`, [
      resourceId,
      who.viewer,
      who.source,
      day,
    ]);
    await q(`UPDATE resource SET view_count = view_count + 1 WHERE id = $1`, [resourceId]);
    return { counted: true };
  });
}

/** Drops view de-duplication rows older than `keepDays` NZ days. */
export async function pruneViews(keepDays = 2, now = new Date()) {
  const cutoff = nzDay(new Date(now.getTime() - keepDays * 86_400_000));
  const rows = await sql(`DELETE FROM resource_view WHERE day < $1 RETURNING 1`, [cutoff]);
  return rows.length;
}
