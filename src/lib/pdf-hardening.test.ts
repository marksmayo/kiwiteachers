import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { decodeName, inspectPdf, MAX_PAGE_SIDE, sanitizePdf } from "./pdf-security";

async function withCatalogAction(s: string) {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const action = pdf.context.obj({ S: PDFName.of(s), JS: undefined });
  action.delete(PDFName.of("JS"));
  pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.register(action));
  return pdf.save({ useObjectStreams: false });
}

describe("active-content detection hardening", () => {
  it("decodes #xx escapes in any case", () => {
    expect(decodeName("#4aavaScript")).toBe("JavaScript");
    expect(decodeName("#4AavaScript")).toBe("JavaScript");
    expect(decodeName("Plain")).toBe("Plain");
  });

  it("catches action names hidden with lowercase hex escapes", async () => {
    expect(await inspectPdf(await withCatalogAction("#4aavaScript"))).toMatchObject({ ok: false, reason: expect.stringMatching(/JavaScript/) });
  });

  it("checks stream dictionaries too", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.context.register(pdf.context.stream("payload", { JS: PDFString.of("app.alert(1)") }));
    expect(await inspectPdf(await pdf.save({ useObjectStreams: false }))).toMatchObject({ ok: false, reason: expect.stringMatching(/JS/) });
  });

  it("rejects FileAttachment annotations", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const annot = pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "FileAttachment", Rect: [0, 0, 10, 10] }));
    page.node.set(PDFName.of("Annots"), pdf.context.obj([annot]));
    expect(await inspectPdf(await pdf.save())).toMatchObject({ ok: false, reason: expect.stringMatching(/FileAttachment/) });
  });

  it("rejects absurd page sizes (watermark/rendering DoS)", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([MAX_PAGE_SIDE + 1, 500]);
    expect(await inspectPdf(await pdf.save())).toMatchObject({ ok: false, reason: expect.stringMatching(/page size/) });
  });
});

describe("sanitizePdf", () => {
  it("keeps pages and plain web links, drops page actions, forms, scripts and other annotations", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    pdf.addPage();
    const ctx = pdf.context;
    const goodLink = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10], A: { S: "URI", URI: PDFString.of("https://tki.org.nz") } }));
    const jsLink = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10], A: { S: "URI", URI: PDFString.of("javascript:alert(1)") } }));
    const launch = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10], A: { S: "Launch", F: PDFString.of("calc.exe") } }));
    const internal = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10] }));
    const aaLink = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10], AA: {} }));
    const widget = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Widget", Rect: [0, 0, 10, 10] }));
    page.node.set(PDFName.of("Annots"), ctx.obj([goodLink, jsLink, launch, internal, aaLink, widget]));
    page.node.set(PDFName.of("AA"), ctx.obj({ O: { S: "JavaScript", JS: PDFString.of("x") } }));
    pdf.catalog.set(PDFName.of("AcroForm"), ctx.obj({ Fields: [] }));
    pdf.catalog.set(PDFName.of("OpenAction"), ctx.register(ctx.obj({ S: "JavaScript", JS: PDFString.of("x") })));

    const clean = await sanitizePdf(await pdf.save());
    const out = await PDFDocument.load(clean);
    expect(out.getPageCount()).toBe(2);
    const [p1, p2] = out.getPages();
    expect(p1.node.has(PDFName.of("AA"))).toBe(false);
    expect(p1.node.Annots()?.size()).toBe(2); // https link + internal link
    expect(p2.node.has(PDFName.of("Annots"))).toBe(false);
    expect(out.catalog.has(PDFName.of("AcroForm"))).toBe(false);
    expect(out.catalog.has(PDFName.of("OpenAction"))).toBe(false);
    expect(await inspectPdf(clean)).toEqual({ ok: true, pageCount: 2 });
  });

  it("removes Annots entirely when nothing is safe", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const w = pdf.context.register(pdf.context.obj({ Subtype: "Widget" }));
    page.node.set(PDFName.of("Annots"), pdf.context.obj([w, PDFString.of("junk")]));
    const out = await PDFDocument.load(await sanitizePdf(await pdf.save()));
    expect(out.getPage(0).node.lookupMaybe(PDFName.of("Annots"), PDFArray)).toBeUndefined();
    expect(out.getPage(0).node instanceof PDFDict).toBe(true);
  });
});
