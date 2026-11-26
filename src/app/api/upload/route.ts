import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { uploadRulesFor } from "@/lib/upload-rules";
import { allowUploadToken } from "@/lib/upload-limit";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser(request.headers);
        if (!user) throw new Error("Please sign in to upload");
        const rules = uploadRulesFor(user.id, pathname);
        if (!rules) throw new Error("Invalid upload path");
        if (!(await allowUploadToken(user))) throw new Error("Too many uploads — please wait a while and try again");
        return { ...rules, validUntil: Date.now() + 10 * 60 * 1000 };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Upload failed" }, { status: 400 });
  }
}
