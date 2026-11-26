import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { countPages, watermarkPdf } from "./watermark";
import { makePdf } from "../../test/pdf-fixtures";

describe("watermarkPdf", () => {
  it("returns a valid PDF with the same pages and extra watermark content", async () => {
    const original = await makePdf(2);
    const marked = await watermarkPdf(original, "KiwiTeachers");
    expect(marked.byteLength).toBeGreaterThan(original.byteLength);
    const doc = await PDFDocument.load(marked);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe("KiwiTeachers preview");
  });

  it("accepts a custom banner", async () => {
    const marked = await watermarkPdf(await makePdf(1), "KiwiTeachers", "Members preview");
    expect(await countPages(marked)).toBe(1);
  });
});
