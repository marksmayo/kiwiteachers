import { getResourceById } from "@/lib/resources";
import { readBlob } from "@/lib/blob";

export async function GET(_request: Request, ctx: RouteContext<"/api/resources/[id]/thumb">) {
  const { id } = await ctx.params;
  const resource = await getResourceById(id);
  if (!resource?.thumb_pathname) return new Response("Not found", { status: 404 });
  const bytes = await readBlob(resource.thumb_pathname);
  if (!bytes) return new Response("Not found", { status: 404 });
  const type = resource.thumb_pathname.endsWith(".png") ? "image/png" : "image/webp";
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
