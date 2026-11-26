import { canView, getResourceById } from "@/lib/resources";
import { readBlob } from "@/lib/blob";
import { inspectImage, MAX_PREVIEW_BYTES } from "@/lib/pdf-security";
import { getCurrentUser } from "@/lib/session";

/**
 * Watermarked page images. These are the only preview format non-privileged
 * viewers get for resources that have them, so the PDF never reaches them.
 * Published previews contain nothing personal, so they're CDN-cached.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/resources/[id]/preview/[page]">) {
  const { id, page } = await ctx.params;
  const n = Number(page);
  const resource = await getResourceById(id);
  if (!resource || !Number.isInteger(n) || n < 1 || n > resource.preview_pathnames.length) {
    return new Response("Not found", { status: 404 });
  }
  const isPublic = resource.status === "published";
  if (!isPublic && !canView(resource, await getCurrentUser(request.headers))) {
    return new Response("Not found", { status: 404 });
  }
  const bytes = await readBlob(resource.preview_pathnames[n - 1]);
  const check = bytes ? inspectImage(bytes, MAX_PREVIEW_BYTES) : null;
  if (!bytes || !check?.ok) return new Response("Not found", { status: 404 });
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": check.type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublic ? "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400" : "private, no-store",
    },
  });
}
