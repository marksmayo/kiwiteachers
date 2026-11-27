import { ipAddress } from "@vercel/functions";
import { getCurrentUser } from "@/lib/session";
import { isLikelyBot, isSameOriginRequest, nzDay, recordView, viewerIdentity } from "@/lib/views";

/**
 * View beacon. Always answers 204 so scripts learn nothing; a view only counts once per viewer per
 * resource per NZ day, from a same-origin browser request, within per-IP caps (see lib/views.ts).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/resources/[id]/view">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  const ok = new Response(null, { status: 204 });

  const userAgent = request.headers.get("user-agent");
  if (!isSameOriginRequest(request.headers, request.headers.get("host")) || isLikelyBot(userAgent)) return ok;

  const ip = ipAddress(request) ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const user = await getCurrentUser(request.headers);
  const day = nzDay();
  const who = viewerIdentity({
    userId: user?.id,
    ip,
    userAgent: userAgent!,
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
    day,
  });
  await recordView(id, { ...who, userId: user?.id, isAdmin: user?.isAdmin }, day);
  return ok;
}
