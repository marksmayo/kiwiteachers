import { describe, expect, it } from "vitest";
import { inspectImage, inspectPdf, MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PDF_PAGES } from "./pdf-security";
import { JPEG_BYTES, makeAttachmentPdf, makeEncryptedPdf, makeJsPdf, makePdf, PNG_BYTES, WEBP_BYTES } from "../../test/pdf-fixtures";

const enc = (s: string) => new TextEncoder().encode(s);

describe("inspectPdf", () => {
  it("accepts a normal PDF and reports its page count", async () => {
    expect(await inspectPdf(await makePdf(3))).toEqual({ ok: true, pageCount: 3 });
  });

  it("rejects empty files", async () => {
    expect(await inspectPdf(new Uint8Array())).toMatchObject({ ok: false, reason: expect.stringMatching(/empty/) });
  });

  it("rejects oversized files without parsing them", async () => {
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    expect(await inspectPdf(big)).toMatchObject({ ok: false, reason: expect.stringMatching(/25 MB/) });
  });

  it("rejects files that aren't PDFs (e.g. HTML renamed to .pdf)", async () => {
    expect(await inspectPdf(enc("<html><script>alert(1)</script></html>"))).toMatchObject({ ok: false, reason: expect.stringMatching(/isn't a PDF/) });
  });

  it("rejects truncated PDFs", async () => {
    const pdf = await makePdf(1);
    expect(await inspectPdf(pdf.slice(0, pdf.length - 400))).toMatchObject({ ok: false, reason: expect.stringMatching(/incomplete|damaged/) });
  });

  it("rejects unreadable PDFs", async () => {
    expect(await inspectPdf(enc("%PDF-1.7\ngarbage garbage\n%%EOF"))).toMatchObject({ ok: false, reason: expect.stringMatching(/couldn't be read|no pages/) });
  });

  it("rejects password-protected PDFs", async () => {
    expect(await inspectPdf(await makeEncryptedPdf())).toMatchObject({ ok: false, reason: expect.stringMatching(/Password-protected/) });
  });

  it("rejects PDFs with too many pages", async () => {
    expect(await inspectPdf(await makePdf(MAX_PDF_PAGES + 1))).toMatchObject({ ok: false, reason: expect.stringMatching(/at most/) });
  });

  it("rejects PDFs that run JavaScript", async () => {
    expect(await inspectPdf(await makeJsPdf())).toMatchObject({ ok: false, reason: expect.stringMatching(/active content/) });
  });

  it("rejects PDFs with embedded files", async () => {
    expect(await inspectPdf(await makeAttachmentPdf())).toMatchObject({ ok: false, reason: expect.stringMatching(/EmbeddedFile/) });
  });
});

describe("inspectImage", () => {
  it("accepts WebP, PNG and JPEG by magic bytes", () => {
    expect(inspectImage(WEBP_BYTES)).toEqual({ ok: true, type: "image/webp" });
    expect(inspectImage(PNG_BYTES)).toEqual({ ok: true, type: "image/png" });
    expect(inspectImage(JPEG_BYTES)).toEqual({ ok: true, type: "image/jpeg" });
  });
  it("rejects empty, oversized and disguised files", () => {
    expect(inspectImage(new Uint8Array()).ok).toBe(false);
    expect(inspectImage(new Uint8Array(MAX_IMAGE_BYTES + 1)).ok).toBe(false);
    expect(inspectImage(enc("<svg onload=alert(1)>")).ok).toBe(false);
  });
});
