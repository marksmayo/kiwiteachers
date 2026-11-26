import { describe, expect, it } from "vitest";
import { MAX_CODES, normaliseCode, normaliseCodes } from "./curriculum";

describe("normaliseCode", () => {
  it("upper-cases and trims valid codes", () => {
    expect(normaliseCode("  ma.p2.num-3 ")).toBe("MA.P2.NUM-3");
    expect(normaliseCode("eng   phase 1")).toBe("ENG PHASE 1");
    expect(normaliseCode("SCI/2:4_b")).toBe("SCI/2:4_B");
  });
  it("rejects empty, too-long and unsafe codes", () => {
    expect(normaliseCode("   ")).toBeNull();
    expect(normaliseCode("A".repeat(41))).toBeNull();
    expect(normaliseCode("<script>")).toBeNull();
    expect(normaliseCode("-starts-with-dash")).toBeNull();
  });
});

describe("normaliseCodes", () => {
  it("splits strings on commas, semicolons and newlines, de-duplicating", () => {
    expect(normaliseCodes("ma1, MA1; en2\nsc3")).toEqual({ codes: ["MA1", "EN2", "SC3"], invalid: [] });
  });
  it("accepts arrays and reports invalid entries", () => {
    expect(normaliseCodes(["ok1", "bad<", ""])).toEqual({ codes: ["OK1"], invalid: ["bad<"] });
  });
  it("caps the number of codes", () => {
    const many = Array.from({ length: MAX_CODES + 5 }, (_, i) => `C${i}`);
    expect(normaliseCodes(many).codes).toHaveLength(MAX_CODES);
  });
});
