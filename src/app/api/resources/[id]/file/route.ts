import { getCurrentUser } from "@/lib/session";
import { canView, getResourceById } from "@/lib/resources";
import { readBlob, SITE_NAME } from "@/lib/blob";
import { watermarkPdf } from "@/lib/watermark";
import { authoriseDownload } from "@/lib/downloads";

/**
 * Previews are watermarked for everyone except admins and the uploader.
 * The clean file is only served as a counted download (5 per NZ day for teachers).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/resources/[id]/file">) {
  const { id } = await ctx.params;
  const resource = await getResourceById(id);
  const user = await getCurrentUser(request.headers);
  if (!resource || !canView(resource, user)) return new Response("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const privileged = !!user && (user.isAdmin || resource.uploaded_by === user.id);

  if (download) {
    if (!user) {
      return Response.redirect(new URL(`/sign-in?next=/resources/${resource.slug}`, request.url), 302);
    }
    if (resource.status !== "published" && !privileged) return new Response("Not found", { status: 404 });
    const { allowed } = await authoriseDownload(user, resource.id);
    if (!allowed) {
      return Response.redirect(new URL(`/resources/${resource.slug}?limit=reached`, request.url), 302);
    }
  }

  // Resources with image previews never send the PDF to non-privileged viewers.
  if (!download && !privileged && resource.preview_pathnames.length > 0) {
    return new Response("Use the image preview", { status: 404 });
  }

  const bytes = await readBlob(resource.blob_pathname);
  if (!bytes) return new Response("File missing", { status: 404 });

  const clean = download || privileged;
  const body = clean
    ? bytes
    : await watermarkPdf(
        bytes,
        SITE_NAME,
        user
          ? `Preview only — download the clean copy at ${SITE_NAME}`
          : `Preview only — sign in free at ${SITE_NAME} to download the clean copy`,
      );

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${resource.slug}.pdf"`,
      "Cache-Control": download ? "private, no-store" : "private, max-age=300",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}
