"use server";

import { del } from "@vercel/blob";
import { refresh } from "next/cache";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readBlob } from "@/lib/blob";
import { countPages } from "@/lib/watermark";
import { LEARNING_AREAS, RESOURCE_TYPES, YEARS } from "@/lib/taxonomy";
import { getResourceById } from "@/lib/resources";

export async function toggleFavourite(resourceId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "signin" };
  const removed = await sql(
    `DELETE FROM favourite WHERE user_id = $1 AND resource_id = $2 RETURNING 1`,
    [user.id, resourceId],
  );
  if (removed.length === 0) {
    await sql(
      `INSERT INTO favourite (user_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, resourceId],
    );
  }
  return { ok: true as const, favourite: removed.length === 0 };
}

export type ResourceInput = {
  id?: string;
  title: string;
  description: string;
  years: number[];
  learningAreas: string[];
  resourceType: string;
  tags: string[];
  blobPathname?: string;
  thumbPathname?: string | null;
  fileSize?: number;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function clean(input: ResourceInput) {
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error("Title is required");
  const areaSlugs = new Set<string>(LEARNING_AREAS.map((a) => a.slug));
  const typeSlugs = new Set<string>(RESOURCE_TYPES.map((t) => t.slug));
  if (!typeSlugs.has(input.resourceType)) throw new Error("Choose a resource type");
  const years = [...new Set(input.years)].filter((y) => YEARS.includes(y)).sort((a, b) => a - b);
  if (!years.length) throw new Error("Choose at least one year level");
  const learningAreas = [...new Set(input.learningAreas)].filter((a) => areaSlugs.has(a));
  if (!learningAreas.length) throw new Error("Choose at least one learning area");
  const tags = [
    ...new Set(
      input.tags
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 20);
  return { title, description: input.description.trim().slice(0, 4000), years, learningAreas, tags, resourceType: input.resourceType };
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new Error("Not authorised");
  return user;
}

export async function saveResource(input: ResourceInput): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  try {
    const user = await requireAdmin();
    const data = clean(input);

    let fileFields: { blob_pathname: string; page_count: number; file_size: number } | null = null;
    if (input.blobPathname) {
      if (!input.blobPathname.startsWith("docs/")) throw new Error("Invalid file");
      const bytes = await readBlob(input.blobPathname);
      if (!bytes) throw new Error("Uploaded file not found");
      let pages = 1;
      try {
        pages = await countPages(bytes);
      } catch {
        throw new Error("That file doesn't look like a valid PDF");
      }
      fileFields = { blob_pathname: input.blobPathname, page_count: pages, file_size: bytes.byteLength };
    }
    const thumb = input.thumbPathname && input.thumbPathname.startsWith("thumbs/") ? input.thumbPathname : null;

    if (input.id) {
      const existing = await getResourceById(input.id);
      if (!existing) throw new Error("Resource not found");
      await sql(
        `UPDATE resource SET title=$2, description=$3, years=$4, learning_areas=$5, resource_type=$6, tags=$7,
           blob_pathname=coalesce($8, blob_pathname), page_count=coalesce($9, page_count), file_size=coalesce($10, file_size),
           thumb_pathname=coalesce($11, thumb_pathname), updated_at=now()
         WHERE id=$1`,
        [input.id, data.title, data.description, data.years, data.learningAreas, data.resourceType, data.tags,
          fileFields?.blob_pathname ?? null, fileFields?.page_count ?? null, fileFields?.file_size ?? null, thumb],
      );
      const stale = [
        fileFields && existing.blob_pathname,
        thumb && existing.thumb_pathname,
      ].filter(Boolean) as string[];
      if (stale.length) await del(stale).catch(() => {});
      refresh();
      return { ok: true, slug: existing.slug };
    }

    if (!fileFields) throw new Error("Please attach a PDF");
    const slug = `${slugify(data.title) || "resource"}-${Math.random().toString(36).slice(2, 7)}`;
    await sql(
      `INSERT INTO resource (slug, title, description, blob_pathname, thumb_pathname, file_size, page_count, years, learning_areas, resource_type, tags, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [slug, data.title, data.description, fileFields.blob_pathname, thumb, fileFields.file_size, fileFields.page_count,
        data.years, data.learningAreas, data.resourceType, data.tags, user.id],
    );
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteResource(id: string) {
  await requireAdmin();
  const existing = await getResourceById(id);
  if (!existing) return;
  await sql(`DELETE FROM resource WHERE id = $1`, [id]);
  await del([existing.blob_pathname, existing.thumb_pathname].filter(Boolean) as string[]).catch(() => {});
  refresh();
}

/** Rate 0.5–5 in half steps; pass null to remove your rating. */
export async function rateResource(resourceId: string, score: number | null) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "signin" };
  if (!/^[0-9a-f-]{36}$/i.test(resourceId)) return { ok: false as const, error: "Invalid resource" };
  if (score === null) {
    await sql(`DELETE FROM rating WHERE user_id = $1 AND resource_id = $2`, [user.id, resourceId]);
  } else {
    if (!Number.isFinite(score) || score < 0.5 || score > 5 || score * 2 !== Math.round(score * 2)) {
      return { ok: false as const, error: "Ratings are 0.5 to 5 stars" };
    }
    await sql(
      `INSERT INTO rating (user_id, resource_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, resource_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now()`,
      [user.id, resourceId, score],
    );
  }
  const [agg] = await sql<{ rating_avg: number | null; rating_count: number }>(
    `SELECT rating_avg::float AS rating_avg, rating_count FROM resource WHERE id = $1`,
    [resourceId],
  );
  return { ok: true as const, ...agg, mine: score };
}
