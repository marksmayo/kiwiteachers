import { PDFDocument, PDFName, PDFString, StandardFonts } from "pdf-lib";

export async function makePdf(pages = 2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) pdf.addPage([595, 842]).drawText(`Page ${i + 1}`, { x: 50, y: 780, size: 20, font });
  return pdf.save();
}

/** A PDF whose catalog runs JavaScript when opened. */
export async function makeJsPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const action = pdf.context.obj({ Type: "Action", S: "JavaScript", JS: PDFString.of("app.alert(1)") });
  pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.register(action));
  return pdf.save({ useObjectStreams: false });
}

/** A PDF with an embedded file attachment. */
export async function makeAttachmentPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await pdf.attach(new TextEncoder().encode("evil"), "payload.txt", { mimeType: "text/plain" });
  return pdf.save();
}

/** Adds an /Encrypt entry to the trailer so loaders treat the file as encrypted. */
export async function makeEncryptedPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const enc = pdf.context.register(pdf.context.obj({ Filter: "Standard", V: 1, R: 2 }));
  pdf.context.trailerInfo.Encrypt = enc;
  return pdf.save({ useObjectStreams: false });
}

export const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
