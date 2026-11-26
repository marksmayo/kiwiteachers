import { canView, getResourceById } from "@/lib/resources";
import { readBlob } from "@/lib/blob";
import { inspectImage } from "@/lib/pdf-security";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request, ctx: RouteContext<"/api/resources/[id]/thumb">) {
  const { id } = await ctx.params;
  const resource = await getResourceById(id);
  if (!resource?.thumb_pathname) return new Response("Not found", { status: 404 });
  const isPublic = resource.status === "published";
  if (!isPublic && !canView(resource, await getCurrentUser(request.headers))) {
    return new Response("Not found", { status: 404 });
  }
  const bytes = await readBlob(resource.thumb_pathname);
  const check = bytes ? inspectImage(bytes) : null;
  if (!bytes || !check?.ok) return new Response("Not found", { status: 404 });
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": check.type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublic
        ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        : "private, no-store",
    },
  });
}
