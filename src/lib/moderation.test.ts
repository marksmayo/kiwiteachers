import { describe, expect, it } from "vitest";
import { moderateText, normaliseForMatching, REASON_LABELS } from "./moderation";

describe("moderateText", () => {
  it.each([
    "My Year 4s loved this — we used it for Matariki and it sparked great discussion.",
    "Great for assessment of fractions. Class of 28, took about 40 minutes.",
    "Ka pai! Worked well with my kura. The peacock and cockatoo pictures were a hit.",
    "We read Dickens afterwards. Scunthorpe-proof, hopefully. Grasshopper unit next.",
    "Ideal for Year 1–3. Shipped it to the whole syndicate.",
    "The class assessed each other's work using the rubric.",
  ])("passes clean teacher text: %s", (text) => {
    expect(moderateText(text)).toEqual({ flagged: false, reasons: [] });
  });

  it.each([
    ["Check out https://spam.example", "link"],
    ["visit www.cheap-stuff.biz now", "link"],
    ["go to mysite.com for more", "link"],
    ["mysite dot com has better", "link"],
    ["buy at shop.co.nz", "link"],
  ])("flags links: %s", (text, reason) => {
    expect(moderateText(text).reasons).toContain(reason);
  });

  it.each(["email me at teacher@school.nz", "contact bob (at) gmail.com"])("flags emails: %s", (text) => {
    expect(moderateText(text).reasons).toContain("email");
  });

  it.each(["call 021 123 4567", "ring +64 9 555 1234 today"])("flags phone numbers: %s", (text) => {
    expect(moderateText(text).reasons).toContain("phone");
  });

  it.each([
    "this is shit",
    "absolute bullsh1t",
    "what a load of $h!t",
    "F U C K this",
    "fuuuuck",
    "total wanker wrote this",
  ])("flags profanity, including disguised forms: %s", (text) => {
    expect(moderateText(text).reasons).toContain("profanity");
  });

  it.each([
    "THIS IS THE BEST RESOURCE EVER BUY NOW",
    "wowwwwwwwwwww",
    "amazing!!!!!!",
    "buy buy buy buy buy buy buy buy buy buy now",
  ])("flags spammy text: %s", (text) => {
    expect(moderateText(text).reasons).toContain("spam");
  });

  it("reports multiple reasons at once", () => {
    const r = moderateText("SHIT RESOURCE GO TO HTTPS://X.COM INSTEAD!!!!!!");
    expect(r.flagged).toBe(true);
    expect(r.reasons).toEqual(expect.arrayContaining(["link", "profanity", "spam"]));
  });

  it("has a human label for every reason", () => {
    for (const reason of ["link", "email", "phone", "profanity", "spam"] as const) expect(REASON_LABELS[reason]).toBeTruthy();
  });
});

describe("normaliseForMatching", () => {
  it("undoes leetspeak, accents and stretched letters", () => {
    expect(normaliseForMatching("Sh1iiiit Māori")).toBe("shiit maori");
  });
});
