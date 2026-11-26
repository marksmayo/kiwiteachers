import "server-only";
import { get } from "@vercel/blob";

export async function readBlob(pathname: string): Promise<Uint8Array | null> {
  const res = await get(pathname, { access: "private" });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return new Uint8Array(await new Response(res.stream).arrayBuffer());
}

export const SITE_NAME = "KiwiTeachers";
