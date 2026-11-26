import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PREVIEW_BYTES } from "./pdf-security";

/** Upload rules per folder. Every signed-in user can upload into their own folder only. */
export function uploadRulesFor(userId: string, pathname: string) {
  if (pathname.includes("..") || pathname.includes("\\")) return null;
  if (pathname.startsWith(`docs/${userId}/`) && pathname.toLowerCase().endsWith(".pdf")) {
    return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_PDF_BYTES, addRandomSuffix: true };
  }
  if (pathname.startsWith(`thumbs/${userId}/`)) {
    return {
      allowedContentTypes: ["image/webp", "image/png", "image/jpeg"],
      maximumSizeInBytes: MAX_IMAGE_BYTES,
      addRandomSuffix: true,
    };
  }
  if (pathname.startsWith(`previews/${userId}/`)) {
    return { allowedContentTypes: ["image/webp", "image/png", "image/jpeg"], maximumSizeInBytes: MAX_PREVIEW_BYTES, addRandomSuffix: true };
  }
  return null;
}
