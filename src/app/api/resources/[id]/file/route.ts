import { getCurrentUser } from "@/lib/session";
import { getResourceById } from "@/lib/resources";
import { readBlob, SITE_NAME } from "@/lib/blob";
import { watermarkPdf } from "@/lib/watermark";

export async function GET(request: Request, ctx: RouteContext<"/api/resources/[id]/file">) {
  const { id } = await ctx.params;
  const resource = await getResourceById(id);
  if (!resource) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser(request.headers);
  const download = new URL(request.url).searchParams.get("download") === "1";

  if (download && !user) {
    return Response.redirect(
      new URL(`/sign-in?next=/resources/${resource.slug}`, request.url),
      302,
    );
  }

  const bytes = await readBlob(resource.blob_pathname);
  if (!bytes) return new Response("File missing", { status: 404 });

  const body = user ? bytes : await watermarkPdf(bytes, SITE_NAME);
  const filename = `${resource.slug}.pdf`;
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
      Vary: "Cookie",
    },
  });
}
