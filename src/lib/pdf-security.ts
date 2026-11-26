import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFStream, type PDFObject } from "pdf-lib";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
/** Largest allowed page side in points (A2 is 1191 × 1684). */
export const MAX_PAGE_SIDE = 3000;

export type InspectResult = { ok: true; pageCount: number } | { ok: false; reason: string };

/** Dictionary keys that indicate active or embedded content we never want to serve. */
const DANGEROUS_KEYS = ["JavaScript", "JS", "EmbeddedFile", "EmbeddedFiles", "RichMedia", "XFA", "Launch"];
/** Action types (/S) that run code, open other files, or phone home. */
const DANGEROUS_ACTIONS = ["JavaScript", "Launch", "ImportData", "SubmitForm", "GoToR", "GoToE", "RichMediaExecute", "Rendition", "Sound", "Movie"];
/** Annotation/object types (/Subtype or /Type values) that carry payloads. */
const DANGEROUS_TYPES = ["FileAttachment", "EmbeddedFile", "RichMedia", "Screen", "Movie", "Sound", "3D"];

/** Decode PDF name escapes (#xx) case-insensitively — readers accept #4a and #4A alike. */
export function decodeName(raw: string) {
  return raw.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

function nameText(n: PDFName) {
  return decodeName(n.decodeText());
}

function startsWith(bytes: Uint8Array, text: string, offset = 0) {
  for (let i = 0; i < text.length; i++) if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  return true;
}

function indexOfAscii(bytes: Uint8Array, text: string, from = 0, to = bytes.length) {
  outer: for (let i = Math.max(0, from); i <= Math.min(bytes.length, to) - text.length; i++) {
    for (let j = 0; j < text.length; j++) if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

function findDanger(obj: PDFObject | undefined, seen = new Set<PDFObject>()): string | null {
  if (!obj || seen.has(obj)) return null;
  seen.add(obj);
  if (obj instanceof PDFStream || obj instanceof PDFRawStream) return findDanger((obj as PDFRawStream).dict, seen);
  if (obj instanceof PDFDict) {
    for (const [key, value] of obj.entries()) {
      const name = nameText(key);
      if (DANGEROUS_KEYS.includes(name)) return name;
      if ((name === "S" || name === "Subtype" || name === "Type") && value instanceof PDFName) {
        const v = nameText(value);
        if ((name === "S" && DANGEROUS_ACTIONS.includes(v)) || (name !== "S" && DANGEROUS_TYPES.includes(v))) return v;
      }
      if (!(value instanceof PDFRef)) {
        const nested = findDanger(value, seen);
        if (nested) return nested;
      }
    }
  } else if (obj instanceof PDFArray) {
    for (const item of obj.asArray()) {
      if (item instanceof PDFRef) continue;
      const nested = findDanger(item, seen);
      if (nested) return nested;
    }
  }
  return null;
}

const READ_ERROR = "The PDF couldn't be read. Try re-exporting it.";

/**
 * Validates an uploaded PDF before it is published:
 * real PDF header, sane size, page count and page dimensions, not encrypted,
 * and no JavaScript, launch actions, attachments, XFA forms or rich media.
 * Uploads that pass are then rebuilt with `sanitizePdf` before being served.
 */
export async function inspectPdf(bytes: Uint8Array): Promise<InspectResult> {
  if (bytes.byteLength === 0) return { ok: false, reason: "The file is empty." };
  if (bytes.byteLength > MAX_PDF_BYTES) return { ok: false, reason: "The file is larger than 25 MB." };
  if (indexOfAscii(bytes, "%PDF-", 0, 1024) === -1) return { ok: false, reason: "That file isn't a PDF." };
  if (indexOfAscii(bytes, "%%EOF", bytes.length - 4096) === -1) {
    return { ok: false, reason: "The PDF looks incomplete or damaged." };
  }

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/encrypt/i.test(msg)) return { ok: false, reason: "Password-protected PDFs can't be uploaded." };
    return { ok: false, reason: READ_ERROR };
  }

  let pageCount: number;
  try {
    pageCount = pdf.getPageCount();
  } catch {
    return { ok: false, reason: READ_ERROR };
  }
  if (pageCount < 1) return { ok: false, reason: "The PDF has no pages." };
  if (pageCount > MAX_PDF_PAGES) return { ok: false, reason: `PDFs can have at most ${MAX_PDF_PAGES} pages.` };
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    if (!(width > 0 && height > 0) || width > MAX_PAGE_SIDE || height > MAX_PAGE_SIDE) {
      return { ok: false, reason: "The PDF has an unusually large page size. Please export it at a standard paper size." };
    }
  }

  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    const danger = findDanger(obj);
    if (danger) {
      return { ok: false, reason: `The PDF contains active content (${danger}), which isn't allowed. Re-export it as a plain PDF.` };
    }
  }
  const catalogDanger = findDanger(pdf.catalog) ?? findDanger(pdf.context.trailerInfo.Info as PDFObject | undefined);
  if (catalogDanger) {
    return { ok: false, reason: `The PDF contains active content (${catalogDanger}), which isn't allowed. Re-export it as a plain PDF.` };
  }
  return { ok: true, pageCount };
}

/** Keep only plain web links; everything else (forms, attachments, scripts, media) goes. */
function isSafeLink(annot: PDFObject | undefined, doc: PDFDocument) {
  const dict = annot instanceof PDFRef ? doc.context.lookup(annot) : annot;
  if (!(dict instanceof PDFDict)) return false;
  const subtype = dict.get(PDFName.of("Subtype"));
  if (!(subtype instanceof PDFName) || nameText(subtype) !== "Link") return false;
  if (dict.has(PDFName.of("AA"))) return false;
  const actionRaw = dict.get(PDFName.of("A"));
  const action = actionRaw instanceof PDFRef ? doc.context.lookup(actionRaw) : actionRaw;
  if (!action) return true; // internal destination link
  if (!(action instanceof PDFDict)) return false;
  const s = action.get(PDFName.of("S"));
  if (!(s instanceof PDFName) || nameText(s) !== "URI") return false;
  const uri = action.get(PDFName.of("URI"));
  const text = uri && "decodeText" in uri ? String((uri as { decodeText(): string }).decodeText()) : "";
  return /^https?:\/\//i.test(text);
}

/**
 * Rebuilds the PDF from its pages into a brand-new document. This drops the
 * original catalog (names trees, OpenAction, AcroForm, attachments, metadata scripts),
 * page-level additional actions, and every annotation except plain http(s) links.
 * The rebuilt copy is what we store and serve — never the raw upload.
 */
export async function sanitizePdf(bytes: Uint8Array): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { updateMetadata: false });
  // Strip on the source pages first, so copyPages only carries over objects that are still reachable.
  for (const page of src.getPages()) {
    const node = page.node;
    node.delete(PDFName.of("AA"));
    const annots = node.Annots();
    if (annots) {
      const keep = annots.asArray().filter((a) => isSafeLink(a, src));
      if (keep.length) node.set(PDFName.of("Annots"), src.context.obj(keep));
      else node.delete(PDFName.of("Annots"));
    }
  }
  const out = await PDFDocument.create({ updateMetadata: false });
  const pages = await out.copyPages(src, src.getPageIndices());
  for (const page of pages) out.addPage(page);
  out.setProducer("KiwiTeachers");
  out.setCreator("KiwiTeachers");
  return out.save({ useObjectStreams: true });
}

export type ImageInspect = { ok: true; type: "image/webp" | "image/png" | "image/jpeg" } | { ok: false; reason: string };

/** Thumbnails/previews must be WebP/PNG/JPEG, checked by magic bytes rather than file name. */
export function inspectImage(bytes: Uint8Array, maxBytes = MAX_IMAGE_BYTES): ImageInspect {
  if (bytes.byteLength === 0) return { ok: false, reason: "Empty image." };
  if (bytes.byteLength > maxBytes) return { ok: false, reason: "Image too large." };
  if (startsWith(bytes, "RIFF") && startsWith(bytes, "WEBP", 8)) return { ok: true, type: "image/webp" };
  if (bytes[0] === 0x89 && startsWith(bytes, "PNG", 1)) return { ok: true, type: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ok: true, type: "image/jpeg" };
  return { ok: false, reason: "Unsupported image type." };
}
