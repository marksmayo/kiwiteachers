import { cleanupOrphanBlobs, pruneRateLimitRows } from "@/lib/blob-cleanup";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { pruneViews } from "@/lib/views";

/**
 * Nightly housekeeping, run by the `nightly-cleanup` schedule in vercel.json.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else gets a 401.
 * Add `?dryRun=1` to see what would be deleted without deleting it.
 */
async function run(request: Request) {
  if (!isAuthorisedCron(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const blobs = await cleanupOrphanBlobs({ dryRun });
  const views = dryRun ? 0 : await pruneViews();
  const uploadTokens = dryRun ? 0 : await pruneRateLimitRows();
  const summary = { ...blobs, deleted: blobs.deleted.length, deletedPaths: blobs.deleted.slice(0, 50), views, uploadTokens };
  console.log("[cleanup]", JSON.stringify({ ...summary, deletedPaths: undefined }));
  return Response.json(summary);
}

export const GET = run;
export const POST = run;
