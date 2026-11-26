import "server-only";
import { sql } from "./db";
import { moderateText, type ModerationReason } from "./moderation";
import type { Actor, Result } from "./resource-service";

export const REVIEW_MIN = 10;
export const REVIEW_MAX = 2000;
export const REVIEWS_PER_DAY = 20;

export type Review = {
  user_id: string;
  resource_id: string;
  author: string;
  score: number;
  body: string;
  review_status: "published" | "flagged" | "hidden";
  flag_reasons: ModerationReason[];
  created_at: Date;
  updated_at: Date;
};

export type FlaggedReview = Review & { resource_title: string; resource_slug: string; author_email: string };

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export function validScore(score: unknown): score is number {
  return typeof score === "number" && Number.isFinite(score) && score >= 0.5 && score <= 5 && score * 2 === Math.round(score * 2);
}

async function isPublished(resourceId: string) {
  if (!isUuid(resourceId)) return false;
  const rows = await sql(`SELECT 1 FROM resource WHERE id = $1 AND status = 'published'`, [resourceId]);
  return rows.length > 0;
}

async function aggregates(resourceId: string) {
  const [agg] = await sql<{ rating_avg: number | null; rating_count: number }>(
    `SELECT rating_avg::float AS rating_avg, rating_count FROM resource WHERE id = $1`,
    [resourceId],
  );
  return agg;
}

/** Star rating only. Keeps any written review. `null` removes the rating and review. */
export async function setRating(actor: Actor, resourceId: string, score: number | null) {
  if (!(await isPublished(resourceId))) return { ok: false as const, error: "Resource not found" };
  if (score === null) {
    await sql(`DELETE FROM rating WHERE user_id = $1 AND resource_id = $2`, [actor.id, resourceId]);
  } else {
    if (!validScore(score)) return { ok: false as const, error: "Ratings are 0.5 to 5 stars" };
    await sql(
      `INSERT INTO rating (user_id, resource_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, resource_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now()`,
      [actor.id, resourceId, score],
    );
  }
  return { ok: true as const, mine: score, ...(await aggregates(resourceId)) };
}

/** Written review (with stars). Flagged text is held for an admin instead of being published. */
export async function writeReview(
  actor: Actor,
  resourceId: string,
  input: { score: number; body: string },
): Promise<Result<{ status: Review["review_status"]; reasons: ModerationReason[] }>> {
  if (!(await isPublished(resourceId))) return { ok: false, error: "Resource not found" };
  if (!validScore(input.score)) return { ok: false, error: "Choose a star rating first" };
  const body = (input.body ?? "").trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  if (body.length < REVIEW_MIN) return { ok: false, error: `Reviews need at least ${REVIEW_MIN} characters` };
  if (body.length > REVIEW_MAX) return { ok: false, error: `Reviews can be at most ${REVIEW_MAX} characters` };

  const [{ n }] = await sql<{ n: number }>(
    `SELECT count(*)::int AS n FROM rating
     WHERE user_id = $1 AND body IS NOT NULL AND updated_at > now() - interval '1 day' AND resource_id <> $2`,
    [actor.id, resourceId],
  );
  if (n >= REVIEWS_PER_DAY) return { ok: false, error: "You've written a lot of reviews today — please try again tomorrow" };

  const mod = moderateText(body);
  // Once an admin hides a review, edits go back to the moderation queue rather than straight to public.
  const [prev] = await sql<{ review_status: string }>(
    `SELECT review_status FROM rating WHERE user_id = $1 AND resource_id = $2 AND body IS NOT NULL`,
    [actor.id, resourceId],
  );
  const status = mod.flagged || prev?.review_status === "hidden" ? "flagged" : "published";
  await sql(
    `INSERT INTO rating (user_id, resource_id, score, body, review_status, flag_reasons)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, resource_id) DO UPDATE SET score = EXCLUDED.score, body = EXCLUDED.body,
       review_status = EXCLUDED.review_status, flag_reasons = EXCLUDED.flag_reasons,
       moderated_by = NULL, moderated_at = NULL, updated_at = now()`,
    [actor.id, resourceId, input.score, body, status, mod.reasons],
  );
  return { ok: true, status, reasons: mod.reasons };
}

/** Removes the written part of a review but keeps the star rating. */
export async function deleteReviewText(actor: Actor, resourceId: string): Promise<Result> {
  if (!isUuid(resourceId)) return { ok: false, error: "Resource not found" };
  await sql(
    `UPDATE rating SET body = NULL, review_status = 'published', flag_reasons = '{}', updated_at = now()
     WHERE user_id = $1 AND resource_id = $2`,
    [actor.id, resourceId],
  );
  return { ok: true };
}

/** Public reviews, plus the viewer's own review whatever its status. */
export async function listReviews(resourceId: string, viewerId: string | null) {
  return sql<Review>(
    `SELECT rt.user_id, rt.resource_id, coalesce(nullif(u.name, ''), 'Former member') AS author, rt.score::float AS score,
            rt.body, rt.review_status, rt.flag_reasons, rt.created_at, rt.updated_at
     FROM rating rt LEFT JOIN "user" u ON u.id = rt.user_id
     WHERE rt.resource_id = $1 AND rt.body IS NOT NULL
       AND (rt.review_status = 'published' OR rt.user_id = $2)
     ORDER BY (rt.user_id = $2) DESC, rt.updated_at DESC
     LIMIT 100`,
    [resourceId, viewerId ?? ""],
  );
}

export async function listFlaggedReviews() {
  return sql<FlaggedReview>(
    `SELECT rt.user_id, rt.resource_id, coalesce(u.name, 'Unknown') AS author, coalesce(u.email, '') AS author_email,
            rt.score::float AS score, rt.body, rt.review_status, rt.flag_reasons, rt.created_at, rt.updated_at,
            r.title AS resource_title, r.slug AS resource_slug
     FROM rating rt JOIN resource r ON r.id = rt.resource_id LEFT JOIN "user" u ON u.id = rt.user_id
     WHERE rt.body IS NOT NULL AND rt.review_status = 'flagged'
     ORDER BY rt.updated_at ASC`,
  );
}

export async function moderateReview(
  actor: Actor,
  userId: string,
  resourceId: string,
  action: "approve" | "hide" | "delete",
): Promise<Result> {
  if (!actor.isAdmin) return { ok: false, error: "Not authorised" };
  if (!isUuid(resourceId)) return { ok: false, error: "Review not found" };
  if (action === "delete") {
    await sql(
      `UPDATE rating SET body = NULL, review_status = 'published', flag_reasons = '{}', moderated_by = $3, moderated_at = now()
       WHERE user_id = $1 AND resource_id = $2`,
      [userId, resourceId, actor.id],
    );
  } else {
    await sql(
      `UPDATE rating SET review_status = $3, moderated_by = $4, moderated_at = now()
       WHERE user_id = $1 AND resource_id = $2 AND body IS NOT NULL`,
      [userId, resourceId, action === "approve" ? "published" : "hidden", actor.id],
    );
  }
  return { ok: true };
}

export async function moderationCounts() {
  const [row] = await sql<{ pending: number; flagged: number }>(
    `SELECT (SELECT count(*)::int FROM resource WHERE status = 'pending') AS pending,
            (SELECT count(*)::int FROM rating WHERE body IS NOT NULL AND review_status = 'flagged') AS flagged`,
  );
  return row;
}
