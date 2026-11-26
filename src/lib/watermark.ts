import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Stamps a tiled diagonal watermark and a footer banner onto every page.
 * Runs on the server, so anonymous visitors never receive the clean file.
 */
export async function watermarkPdf(bytes: Uint8Array, siteName: string) {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = `${siteName} · PREVIEW`;
  const size = 26;
  const textWidth = font.widthOfTextAtSize(text, size);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const stepX = textWidth + 70;
    const stepY = 150;
    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        page.drawText(text, {
          x: x + ((y / stepY) % 2) * (stepX / 2),
          y,
          size,
          font,
          color: rgb(0.12, 0.36, 0.25),
          opacity: 0.16,
          rotate: degrees(32),
        });
      }
    }
    // Footer banner
    const banner = `Preview only — sign in free at ${siteName} to download the clean copy`;
    const bSize = 9;
    const bWidth = font.widthOfTextAtSize(banner, bSize);
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 22,
      color: rgb(0.12, 0.36, 0.25),
      opacity: 0.92,
    });
    page.drawText(banner, {
      x: (width - bWidth) / 2,
      y: 7,
      size: bSize,
      font,
      color: rgb(1, 1, 1),
    });
  }
  pdf.setTitle(`${siteName} preview`);
  return pdf.save();
}

export async function countPages(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPageCount();
}
