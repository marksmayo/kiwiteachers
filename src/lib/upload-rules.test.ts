import { describe, expect, it } from "vitest";
import { uploadRulesFor } from "./upload-rules";

describe("uploadRulesFor", () => {
  it("allows PDFs only in the user's own docs folder", () => {
    expect(uploadRulesFor("u1", "docs/u1/sheet.pdf")?.allowedContentTypes).toEqual(["application/pdf"]);
    expect(uploadRulesFor("u1", "docs/u2/sheet.pdf")).toBeNull();
    expect(uploadRulesFor("u1", "docs/u1/sheet.exe")).toBeNull();
    expect(uploadRulesFor("u1", "docs/sheet.pdf")).toBeNull();
  });
  it("allows small images only in the user's own thumbs folder", () => {
    const rules = uploadRulesFor("u1", "thumbs/u1/t.webp");
    expect(rules?.allowedContentTypes).toContain("image/webp");
    expect(rules?.maximumSizeInBytes).toBe(1024 * 1024);
    expect(uploadRulesFor("u1", "thumbs/u2/t.webp")).toBeNull();
  });
  it("allows larger preview images only in the user's own previews folder", () => {
    expect(uploadRulesFor("u1", "previews/u1/p1.webp")?.maximumSizeInBytes).toBe(2 * 1024 * 1024);
    expect(uploadRulesFor("u1", "previews/u2/p1.webp")).toBeNull();
  });

  it("blocks path traversal and other folders", () => {
    expect(uploadRulesFor("u1", "docs/u1/../u2/x.pdf")).toBeNull();
    expect(uploadRulesFor("u1", "docs\\u1\\x.pdf")).toBeNull();
    expect(uploadRulesFor("u1", "public/u1/x.pdf")).toBeNull();
  });
});
