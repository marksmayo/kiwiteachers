import { incrementViews } from "@/lib/resources";

export async function POST(_request: Request, ctx: RouteContext<"/api/resources/[id]/view">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  await incrementViews(id);
  return new Response(null, { status: 204 });
}
