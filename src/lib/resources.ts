import "server-only";
import { sql } from "./db";

export type Resource = {
  id: string;
  slug: string;
  title: string;
  description: string;
  blob_pathname: string;
  thumb_pathname: string | null;
  file_size: number;
  page_count: number;
  years: number[];
  learning_areas: string[];
  resource_type: string;
  tags: string[];
  view_count: number;
  download_count: number;
  rating_avg: number | null;
  rating_count: number;
  my_rating?: number | null;
  created_at: Date;
  favourite_count?: number;
  is_favourite?: boolean;
};

export type SearchParams = {
  q?: string;
  year?: string;
  area?: string;
  type?: string;
  tag?: string;
  rating?: string;
  sort?: string;
  page?: string;
};

export const PAGE_SIZE = 24;

const COLS = `r.id, r.slug, r.title, r.description, r.blob_pathname, r.thumb_pathname, r.file_size,
  r.page_count, r.years, r.learning_areas, r.resource_type, r.tags, r.view_count, r.download_count,
  r.rating_avg::float AS rating_avg, r.rating_count, r.created_at`;

function favCol(userId: string | null, idx: number) {
  return userId
    ? `EXISTS (SELECT 1 FROM favourite f WHERE f.resource_id = r.id AND f.user_id = $${idx}) AS is_favourite`
    : `false AS is_favourite`;
}

/** "fract dec" → "fract:* & dec:*" (prefix matching, safe characters only) */
function toPrefixQuery(q: string) {
  const words = q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}

export async function searchResources(params: SearchParams, userId: string | null) {
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (v: unknown) => {
    args.push(v);
    return `$${args.length}`;
  };

  const q = params.q?.trim();
  let rankExpr = "0";
  if (q) {
    const tsq = toPrefixQuery(q);
    const like = add(`%${q.replace(/[%_\\]/g, "\\$&")}%`);
    if (tsq) {
      const t = add(tsq);
      where.push(
        `(r.search @@ to_tsquery('english', ${t}) OR r.title ILIKE ${like} OR EXISTS (SELECT 1 FROM unnest(r.tags) tg WHERE tg ILIKE ${like}))`,
      );
      rankExpr = `ts_rank(r.search, to_tsquery('english', ${t})) + similarity(r.title, ${add(q)})`;
    } else {
      where.push(`r.title ILIKE ${like}`);
    }
  }
  const year = params.year !== undefined && params.year !== "" ? Number(params.year) : NaN;
  if (Number.isInteger(year)) where.push(`${add(year)} = ANY(r.years)`);
  if (params.area) where.push(`${add(params.area)} = ANY(r.learning_areas)`);
  if (params.type) where.push(`r.resource_type = ${add(params.type)}`);
  if (params.tag) where.push(`${add(params.tag.toLowerCase())} = ANY(r.tags)`);
  const minRating = Number(params.rating);
  if (minRating > 0 && minRating <= 5) where.push(`r.rating_avg >= ${add(minRating)}`);

  const sort = params.sort ?? (q ? "relevance" : "newest");
  const order =
    sort === "relevance" && q
      ? `rank DESC, r.created_at DESC`
      : sort === "title"
        ? `r.title ASC`
        : sort === "rating"
          ? `r.rating_avg DESC NULLS LAST, r.rating_count DESC, r.created_at DESC`
        : sort === "popular"
          ? `favourite_count DESC, r.download_count DESC, r.view_count DESC, r.created_at DESC`
          : `r.created_at DESC`;

  const page = Math.max(1, Number(params.page) || 1);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const userIdx = userId ? Number(add(userId).slice(1)) : 0;
  const limit = add(PAGE_SIZE);
  const offset = add((page - 1) * PAGE_SIZE);

  const rows = await sql<Resource & { rank: number; total: number }>(
    `SELECT ${COLS}, ${rankExpr} AS rank, ${favCol(userId, userIdx)},
       (SELECT count(*)::int FROM favourite f2 WHERE f2.resource_id = r.id) AS favourite_count,
       count(*) OVER()::int AS total
     FROM resource r ${whereSql}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${offset}`,
    args,
  );
  return { rows, total: rows[0]?.total ?? 0, page, pageCount: Math.ceil((rows[0]?.total ?? 0) / PAGE_SIZE) };
}

export async function getResourceBySlug(slug: string, userId: string | null) {
  const rows = await sql<Resource>(
    `SELECT ${COLS}, ${favCol(userId, 2)},
       ${userId ? `(SELECT score::float FROM rating rt WHERE rt.resource_id = r.id AND rt.user_id = $2)` : "NULL"} AS my_rating,
       (SELECT count(*)::int FROM favourite f2 WHERE f2.resource_id = r.id) AS favourite_count
     FROM resource r WHERE r.slug = $1`,
    userId ? [slug, userId] : [slug],
  );
  return rows[0] ?? null;
}

export async function getResourceById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql<Resource>(`SELECT ${COLS} FROM resource r WHERE r.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getRelated(resource: Resource, userId: string | null) {
  return sql<Resource>(
    `SELECT ${COLS}, ${favCol(userId, 5)}
     FROM resource r
     WHERE r.id <> $1 AND (r.learning_areas && $2 OR r.tags && $3) AND r.years && $4
     ORDER BY cardinality(ARRAY(SELECT unnest(r.tags) INTERSECT SELECT unnest($3::text[]))) DESC, r.created_at DESC
     LIMIT 4`,
    [resource.id, resource.learning_areas, resource.tags, resource.years.length ? resource.years : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], ...(userId ? [userId] : [])],
  );
}

export async function getFavourites(userId: string) {
  return sql<Resource>(
    `SELECT ${COLS}, true AS is_favourite
     FROM favourite f JOIN resource r ON r.id = f.resource_id
     WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
    [userId],
  );
}

export async function getPopularTags(limit = 18) {
  return sql<{ tag: string; n: number }>(
    `SELECT tag, count(*)::int AS n FROM resource, unnest(tags) AS tag
     GROUP BY tag ORDER BY n DESC, tag LIMIT $1`,
    [limit],
  );
}

export async function getAreaCounts() {
  const rows = await sql<{ area: string; n: number }>(
    `SELECT area, count(*)::int AS n FROM resource, unnest(learning_areas) AS area GROUP BY area`,
  );
  return Object.fromEntries(rows.map((r) => [r.area, r.n])) as Record<string, number>;
}

export async function getStats() {
  const [row] = await sql<{ resources: number; users: number }>(
    `SELECT (SELECT count(*)::int FROM resource) AS resources, (SELECT count(*)::int FROM "user") AS users`,
  );
  return row;
}

export async function listAllResources() {
  return sql<Resource>(
    `SELECT ${COLS}, (SELECT count(*)::int FROM favourite f2 WHERE f2.resource_id = r.id) AS favourite_count
     FROM resource r ORDER BY r.created_at DESC`,
  );
}

export async function incrementViews(id: string) {
  await sql(`UPDATE resource SET view_count = view_count + 1 WHERE id = $1`, [id]);
}

export async function incrementDownloads(id: string) {
  await sql(`UPDATE resource SET download_count = download_count + 1 WHERE id = $1`, [id]);
}
