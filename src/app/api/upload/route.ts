import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser(request.headers);
        if (!user?.isAdmin) throw new Error("Only admins can upload resources");
        if (!/^(docs|thumbs)\//.test(pathname)) throw new Error("Invalid path");
        return {
          allowedContentTypes: ["application/pdf", "image/webp", "image/png", "image/jpeg"],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
