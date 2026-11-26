import "server-only";
import { del, put } from "@vercel/blob";
import { sql } from "./db";
import { readBlob } from "./blob";
import { inspectImage, inspectPdf, MAX_PDF_PAGES, MAX_PREVIEW_BYTES, sanitizePdf } from "./pdf-security";
import { normaliseCodes } from "./curriculum";
import { getResourceById, type ResourceStatus } from "./resources";
import { LEARNING_AREAS, RESOURCE_TYPES, YEARS } from "./taxonomy";

export type Actor = { id: string; isAdmin: boolean };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const CONTRIBUTOR_DAILY_LIMIT = 10;
export const CONTRIBUTOR_PENDING_LIMIT = 20;

export type ResourceInput = {
  id?: string;
  title: string;
  description: string;
  years: number[];
  learningAreas: string[];
  resourceType: string;
  tags: string[];
  curriculumCodes?: string[];
  blobPathname?: string;
  thumbPathname?: string | null;
  previewPathnames?: string[];
  acceptedRights?: boolean;
};

export class UserError extends Error {}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function cleanResourceInput(input: ResourceInput) {
  const title = (input.title ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  if (!title) throw new UserError("Title is required");
  const areaSlugs = new Set<string>(LEARNING_AREAS.map((a) => a.slug));
  const typeSlugs = new Set<string>(RESOURCE_TYPES.map((t) => t.slug));
  if (!typeSlugs.has(input.resourceType)) throw new UserError("Choose a resource type");
  const years = [...new Set(input.years ?? [])].filter((y) => YEARS.includes(y)).sort((a, b) => a - b);
  if (!years.length) throw new UserError("Choose at least one year level");
  const learningAreas = [...new Set(input.learningAreas ?? [])].filter((a) => areaSlugs.has(a));
  if (!learningAreas.length) throw new UserError("Choose at least one learning area");
  const tags = [
    ...new Set(
      (input.tags ?? [])
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 20);
  const { codes, invalid } = normaliseCodes(input.curriculumCodes ?? []);
  if (invalid.length) throw new UserError(`Invalid curriculum code: ${invalid[0]}`);
  return {
    title,
    description: (input.description ?? "").trim().slice(0, 4000),
    years,
    learningAreas,
    tags,
    curriculumCodes: codes,
    resourceType: input.resourceType,
  };
}

async function deleteBlobs(paths: (string | null | undefined)[]) {
  const list = paths.filter(Boolean) as string[];
  if (list.length) await del(list).catch(() => {});
}

/** Uploaded files must live under the uploader's own folder, so nobody can claim someone else's upload. */
function ownsPath(actor: Actor, path: string, folder: "docs" | "thumbs" | "previews") {
  return path.startsWith(`${folder}/${actor.id}/`) && !path.includes("..");
}

/** A fresh upload must not already belong to a resource — stops one resource hijacking (and later deleting) another's files. */
async function assertUnclaimed(paths: string[]) {
  if (!paths.length) return;
  const rows = await sql(
    `SELECT 1 FROM resource WHERE blob_pathname = ANY($1) OR thumb_pathname = ANY($1) OR preview_pathnames && $1 LIMIT 1`,
    [paths],
  );
  if (rows.length) throw new UserError("Invalid file");
}

/** Validates the raw upload, stores a sanitised rebuild, and deletes the raw upload. */
async function ingestPdf(actor: Actor, path: string) {
  if (!ownsPath(actor, path, "docs")) throw new UserError("Invalid file");
  await assertUnclaimed([path]);
  const bytes = await readBlob(path);
  if (!bytes) throw new UserError("Uploaded file not found — please upload it again");
  const check = await inspectPdf(bytes);
  if (!check.ok) {
    await deleteBlobs([path]);
    throw new UserError(check.reason);
  }
  const clean = await sanitizePdf(bytes);
  const recheck = await inspectPdf(clean);
  if (!recheck.ok) {
    await deleteBlobs([path]);
    throw new UserError(recheck.reason);
  }
  const stored = await put(`docs/${actor.id}/clean.pdf`, Buffer.from(clean), {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/pdf",
  });
  await deleteBlobs([path]);
  return { blob_pathname: stored.pathname, page_count: recheck.pageCount, file_size: clean.byteLength };
}

async function verifyThumb(actor: Actor, path: string | null | undefined) {
  if (!path || !ownsPath(actor, path, "thumbs")) return null;
  const claimed = await sql(`SELECT 1 FROM resource WHERE thumb_pathname = $1 LIMIT 1`, [path]);
  if (claimed.length) return null;
  const bytes = await readBlob(path);
  if (!bytes || !inspectImage(bytes).ok) {
    await deleteBlobs([path]);
    return null;
  }
  return path;
}

/** Previews are watermarked page images rendered at upload. All-or-nothing: any bad image drops the set. */
async function verifyPreviews(actor: Actor, paths: string[] | undefined, pageCount: number) {
  if (!paths?.length) return null;
  const unique = [...new Set(paths)];
  const valid =
    unique.length === paths.length &&
    paths.length === pageCount &&
    paths.length <= MAX_PDF_PAGES &&
    paths.every((p) => ownsPath(actor, p, "previews"));
  if (valid) {
    const claimed = await sql(`SELECT 1 FROM resource WHERE preview_pathnames && $1 LIMIT 1`, [paths]);
    if (!claimed.length) {
      const images = await Promise.all(paths.map((p) => readBlob(p)));
      if (images.every((b) => b && inspectImage(b, MAX_PREVIEW_BYTES).ok)) return paths;
    }
  }
  await deleteBlobs(paths.filter((p) => ownsPath(actor, p, "previews")));
  return null;
}

export async function saveResource(
  actor: Actor,
  input: ResourceInput,
): Promise<Result<{ slug: string; status: ResourceStatus }>> {
  try {
    const data = cleanResourceInput(input);

    if (input.id) {
      const existing = await getResourceById(input.id);
      if (!existing) throw new UserError("Resource not found");
      const isOwner = existing.uploaded_by === actor.id;
      if (!actor.isAdmin && !(isOwner && existing.status !== "published")) {
        throw new UserError("You can't edit this resource");
      }
      const newPath = input.blobPathname && input.blobPathname !== existing.blob_pathname ? input.blobPathname : null;
      const file = newPath ? await ingestPdf(actor, newPath) : null;
      const thumb = input.thumbPathname !== existing.thumb_pathname ? await verifyThumb(actor, input.thumbPathname) : null;
      const previews = await verifyPreviews(actor, input.previewPathnames, file?.page_count ?? existing.page_count);
      // Contributor edits go back into the approval queue.
      const status: ResourceStatus = actor.isAdmin ? existing.status : "pending";
      // A new file without matching previews would leave stale page images: drop them.
      const previewValue = previews ?? (file ? [] : null);
      await sql(
        `UPDATE resource SET title=$2, description=$3, years=$4, learning_areas=$5, resource_type=$6, tags=$7,
           curriculum_codes=$8, blob_pathname=coalesce($9, blob_pathname), page_count=coalesce($10, page_count),
           file_size=coalesce($11, file_size), thumb_pathname=coalesce($12, thumb_pathname),
           preview_pathnames=coalesce($14, preview_pathnames), status=$13,
           rejection_reason = CASE WHEN $13 = 'pending' THEN NULL ELSE rejection_reason END, updated_at=now()
         WHERE id=$1`,
        [existing.id, data.title, data.description, data.years, data.learningAreas, data.resourceType, data.tags,
          data.curriculumCodes, file?.blob_pathname ?? null, file?.page_count ?? null, file?.file_size ?? null, thumb, status,
          previewValue],
      );
      await deleteBlobs([
        file && existing.blob_pathname,
        thumb && existing.thumb_pathname,
        ...(previewValue ? existing.preview_pathnames : []),
      ]);
      return { ok: true, slug: existing.slug, status };
    }

    if (!actor.isAdmin) {
      if (!input.acceptedRights) throw new UserError("Please confirm you have the right to share this resource");
      const [counts] = await sql<{ today: number; pending: number }>(
        `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS today,
                count(*) FILTER (WHERE status = 'pending')::int AS pending
         FROM resource WHERE uploaded_by = $1`,
        [actor.id],
      );
      if (counts.today >= CONTRIBUTOR_DAILY_LIMIT) throw new UserError("You've reached today's submission limit — try again tomorrow");
      if (counts.pending >= CONTRIBUTOR_PENDING_LIMIT) throw new UserError("You have too many submissions awaiting review");
    }
    if (!input.blobPathname) throw new UserError("Please attach a PDF");
    const file = await ingestPdf(actor, input.blobPathname);
    const thumb = await verifyThumb(actor, input.thumbPathname);
    const previews = await verifyPreviews(actor, input.previewPathnames, file.page_count);
    const status: ResourceStatus = actor.isAdmin ? "published" : "pending";
    const slug = `${slugify(data.title) || "resource"}-${crypto.randomUUID().slice(0, 5)}`;
    await sql(
      `INSERT INTO resource (slug, title, description, blob_pathname, thumb_pathname, file_size, page_count, years,
         learning_areas, resource_type, tags, curriculum_codes, uploaded_by, status, preview_pathnames)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [slug, data.title, data.description, file.blob_pathname, thumb, file.file_size, file.page_count, data.years,
        data.learningAreas, data.resourceType, data.tags, data.curriculumCodes, actor.id, status, previews ?? []],
    );
    return { ok: true, slug, status };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Admins can delete anything; contributors can withdraw their own unpublished submissions. */
export async function deleteResource(actor: Actor, id: string): Promise<Result> {
  const existing = await getResourceById(id);
  if (!existing) return { ok: false, error: "Resource not found" };
  const isOwner = existing.uploaded_by === actor.id;
  if (!actor.isAdmin && !(isOwner && existing.status !== "published")) {
    return { ok: false, error: "You can't delete this resource" };
  }
  await sql(`DELETE FROM resource WHERE id = $1`, [id]);
  await deleteBlobs([existing.blob_pathname, existing.thumb_pathname, ...existing.preview_pathnames]);
  return { ok: true };
}

export async function decideResource(
  actor: Actor,
  id: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<Result> {
  if (!actor.isAdmin) return { ok: false, error: "Not authorised" };
  const existing = await getResourceById(id);
  if (!existing) return { ok: false, error: "Resource not found" };
  if (existing.status !== "pending") return { ok: false, error: "This resource isn't awaiting review" };
  if (decision === "approve") {
    await sql(
      `UPDATE resource SET status='published', reviewed_by=$2, reviewed_at=now(), rejection_reason=NULL, created_at=now()
       WHERE id=$1`,
      [id, actor.id],
    );
  } else {
    const why = (reason ?? "").trim().slice(0, 500);
    if (!why) return { ok: false, error: "Please give the contributor a reason" };
    await sql(
      `UPDATE resource SET status='rejected', reviewed_by=$2, reviewed_at=now(), rejection_reason=$3 WHERE id=$1`,
      [id, actor.id, why],
    );
  }
  return { ok: true };
}

/** Runs before an account is deleted: unpublished submissions and their files go with it. */
export async function cleanupUserData(userId: string) {
  const rows = await sql<{ blob_pathname: string; thumb_pathname: string | null; preview_pathnames: string[] }>(
    `DELETE FROM resource WHERE uploaded_by = $1 AND status <> 'published'
     RETURNING blob_pathname, thumb_pathname, preview_pathnames`,
    [userId],
  );
  await deleteBlobs(rows.flatMap((r) => [r.blob_pathname, r.thumb_pathname, ...(r.preview_pathnames ?? [])]));
  return rows.length;
}
