import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

const O = "https://kiwiteachers.vercel.app";

describe("safeNext", () => {
  it.each([
    ["/resources/abc", "/resources/abc"],
    ["/resources?q=maths#top", "/resources?q=maths#top"],
    ["/favourites", "/favourites"],
  ])("keeps same-site path %s", (input, out) => expect(safeNext(input, O)).toBe(out));

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5Cevil.example".replace("%5C", "\\"),
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
  ])("rejects %j", (input) => expect(safeNext(input as string, O)).toBe("/"));

  it("works without an explicit origin (server render)", () => {
    expect(safeNext("/account")).toBe("/account");
  });
});
